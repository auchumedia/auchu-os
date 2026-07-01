-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 021 : Schéma des équipes (teams / team_memberships / team_clients)
-- ══════════════════════════════════════════════════════════════════════════════
-- Additif uniquement — sans risque, déployable à n'importe quel moment avant
-- le reste de la refonte des rôles (022/023). L'ancien code continue de
-- fonctionner sans modification tant que 023 n'est pas appliquée.
--
-- Nommage : "team_members" existe déjà (001_initial_schema.sql — ancien
-- roster de pigistes, non utilisé par le code actuel). La table de jonction
-- équipe↔membre ci-dessous est donc nommée "team_memberships" pour éviter
-- toute collision avec cette table legacy, qui n'est pas touchée ici.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.teams (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid references public.organizations(id) on delete cascade not null,
  name       text not null,
  chef_id    uuid references auth.users(id) on delete restrict not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint teams_chef_unique unique (chef_id)
);

create table if not exists public.team_memberships (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid references public.teams(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  role       text not null check (role in ('chef_equipe', 'stratege', 'monteur')),
  joined_at  timestamptz default now(),
  constraint team_memberships_user_unique unique (user_id)
);

create table if not exists public.team_clients (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references public.teams(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete cascade not null,
  assigned_at timestamptz default now(),
  constraint team_clients_client_unique unique (client_id)
);

create index if not exists team_memberships_team_id_idx on public.team_memberships(team_id);
create index if not exists team_clients_team_id_idx     on public.team_clients(team_id);

alter table public.invitations
  add column if not exists team_id uuid references public.teams(id) on delete set null;

drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at
  before update on public.teams
  for each row execute procedure public.handle_updated_at();

alter table public.teams           enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_clients    enable row level security;

-- ── 2. Fonctions SECURITY DEFINER (contournent RLS, même pattern que 009) ──────

create or replace function public.my_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.org_members
  where user_id = auth.uid() and status = 'actif'
  limit 1
$$;

create or replace function public.my_org_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.org_members
  where user_id = auth.uid() and status = 'actif'
  limit 1
$$;

create or replace function public.my_team_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.team_memberships
  where user_id = auth.uid()
  limit 1
$$;

-- Miroir exact de src/lib/roles.ts:canManageRole — à garder synchronisé manuellement.
create or replace function public.can_manage_role(actor text, target text)
returns boolean
language sql
immutable
as $$
  select case actor
    when 'owner'       then target in ('director', 'chef_equipe', 'stratege', 'monteur')
    when 'director'    then target in ('chef_equipe', 'stratege', 'monteur')
    when 'chef_equipe'  then target in ('stratege', 'monteur')
    else false
  end
$$;

-- team_ids ayant une invitation active non expirée (mirror de
-- org_ids_with_active_invitation() — migration 017 — pour le self-join).
create or replace function public.team_ids_with_active_invitation()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.invitations
  where used_at is null and expires_at > now() and team_id is not null
$$;

grant execute on function public.my_org_id()                        to authenticated;
grant execute on function public.my_org_role()                      to authenticated;
grant execute on function public.my_team_id()                       to authenticated;
grant execute on function public.can_manage_role(text, text)        to authenticated;
grant execute on function public.team_ids_with_active_invitation()  to authenticated;

-- ── 3. RPCs de gestion d'équipe (security definer — vérifient le rôle en interne,
--       ne pas se fier uniquement au contrôle de la route API appelante) ────────

create or replace function public.create_team(p_org_id uuid, p_name text, p_chef_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teams;
begin
  if public.my_org_role() not in ('owner', 'director') then
    raise exception 'forbidden: only owner/director can create teams';
  end if;

  insert into public.teams (org_id, name, chef_id)
  values (p_org_id, p_name, p_chef_id)
  returning * into t;

  insert into public.team_memberships (team_id, user_id, role)
  values (t.id, p_chef_id, 'chef_equipe');

  return t;
end;
$$;

create or replace function public.reassign_team_chef(p_team_id uuid, p_new_chef_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_org_role() not in ('owner', 'director') then
    raise exception 'forbidden: only owner/director can reassign a team chef';
  end if;

  delete from public.team_memberships where team_id = p_team_id and role = 'chef_equipe';

  update public.teams set chef_id = p_new_chef_id, updated_at = now() where id = p_team_id;

  insert into public.team_memberships (team_id, user_id, role)
  values (p_team_id, p_new_chef_id, 'chef_equipe');
end;
$$;

grant execute on function public.create_team(uuid, text, uuid)       to authenticated;
grant execute on function public.reassign_team_chef(uuid, uuid)      to authenticated;

-- ── 4. Policies RLS ──────────────────────────────────────────────────────────

-- teams
create policy "teams: owner_director read"
  on public.teams for select to authenticated
  using (public.my_org_role() in ('owner', 'director') and org_id = public.my_org_id());

create policy "teams: own team read"
  on public.teams for select to authenticated
  using (id = public.my_team_id());

create policy "teams: owner_director write"
  on public.teams for all to authenticated
  using      (public.my_org_role() in ('owner', 'director') and org_id = public.my_org_id())
  with check (public.my_org_role() in ('owner', 'director') and org_id = public.my_org_id());

-- team_memberships
create policy "team_memberships: owner_director read"
  on public.team_memberships for select to authenticated
  using (
    public.my_org_role() in ('owner', 'director')
    and team_id in (select id from public.teams where org_id = public.my_org_id())
  );

create policy "team_memberships: own team read"
  on public.team_memberships for select to authenticated
  using (team_id = public.my_team_id());

create policy "team_memberships: owner_director write"
  on public.team_memberships for all to authenticated
  using (
    public.my_org_role() in ('owner', 'director')
    and team_id in (select id from public.teams where org_id = public.my_org_id())
  )
  with check (
    public.my_org_role() in ('owner', 'director')
    and team_id in (select id from public.teams where org_id = public.my_org_id())
  );

create policy "team_memberships: chef manages own team"
  on public.team_memberships for all to authenticated
  using      (public.my_org_role() = 'chef_equipe' and team_id = public.my_team_id() and role in ('stratege', 'monteur'))
  with check (public.my_org_role() = 'chef_equipe' and team_id = public.my_team_id() and role in ('stratege', 'monteur'));

create policy "team_memberships: join via invitation"
  on public.team_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and team_id in (select public.team_ids_with_active_invitation())
  );

-- team_clients
create policy "team_clients: read"
  on public.team_clients for select to authenticated
  using (
    (public.my_org_role() in ('owner', 'director') and team_id in (select id from public.teams where org_id = public.my_org_id()))
    or team_id = public.my_team_id()
  );

create policy "team_clients: owner_director write"
  on public.team_clients for all to authenticated
  using (
    public.my_org_role() in ('owner', 'director')
    and team_id in (select id from public.teams where org_id = public.my_org_id())
  )
  with check (
    public.my_org_role() in ('owner', 'director')
    and team_id in (select id from public.teams where org_id = public.my_org_id())
  );

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('teams', 'team_memberships', 'team_clients')
order by tablename, policyname;
