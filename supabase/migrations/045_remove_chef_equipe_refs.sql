-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 045 : Retire toute référence à chef_equipe des fonctions SQL et
-- des policies RLS (le rôle lui-même a été retiré des rôles valides par la
-- migration 044 — org_members/invitations n'ont plus aucune ligne à ce rôle).
-- ══════════════════════════════════════════════════════════════════════════════
-- Choix produit (team creation) : la personne qui crée une équipe
-- (owner/director) en devient automatiquement le chef — il n'y a plus de
-- rôle "chef d'équipe" dédié. create_team()/reassign_team_chef() n'insèrent
-- donc plus de ligne team_memberships pour le chef : un owner/director a
-- déjà un accès complet, il n'a pas besoin de my_team_id() pour voir son
-- équipe. Les anciennes lignes team_memberships.role = 'chef_equipe'
-- (créées par l'ancien create_team()) sont supprimées puisqu'elles ne
-- servent plus à rien — le chef accède à son équipe via teams.chef_id.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. team_memberships : retire chef_equipe des rôles valides ──────────────

delete from public.team_memberships where role = 'chef_equipe';

alter table public.team_memberships drop constraint if exists team_memberships_role_check;
alter table public.team_memberships add constraint team_memberships_role_check
  check (role in ('stratege', 'monteur'));

-- ── 2. can_manage_role() — miroir de src/lib/roles.ts::MANAGEABLE_ROLES ─────

create or replace function public.can_manage_role(actor text, target text)
returns boolean
language sql
immutable
as $$
  select case actor
    when 'owner'    then target in ('director', 'stratege', 'monteur')
    when 'director' then target in ('stratege', 'monteur')
    else false
  end
$$;

-- ── 3. create_team() — le créateur (owner/director) devient chef_id sans
--       ligne team_memberships dédiée (cf. note en-tête). ───────────────────

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

  return t;
end;
$$;

-- ── 4. reassign_team_chef() — idem, ne touche plus team_memberships. ───────

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

  update public.teams set chef_id = p_new_chef_id, updated_at = now() where id = p_team_id;
end;
$$;

-- ── 5. Policies devenues mortes (plus aucun org_member n'a role='chef_equipe')
--       — director couvre déjà tout owner/director via les policies
--       "*: director *" / "*: owner_director *", org-wide plutôt que scopées
--       à une équipe. ─────────────────────────────────────────────────────────

drop policy if exists "team_memberships: chef manages own team" on public.team_memberships;
drop policy if exists "org_members: chef updates team roles"     on public.org_members;
drop policy if exists "tasks: chef read"                          on public.tasks;
drop policy if exists "tasks: chef insert"                        on public.tasks;
drop policy if exists "tasks: chef update"                        on public.tasks;
drop policy if exists "tasks: chef delete"                        on public.tasks;
drop policy if exists "time_entries: chef read"                   on public.time_entries;

-- ── 6. Policies avec chef_equipe dans une liste de rôles — retire la valeur,
--       reste identique fonctionnellement pour les rôles restants. ─────────

drop policy if exists "org_members: director updates managed roles" on public.org_members;
create policy "org_members: director updates managed roles"
  on public.org_members for update to authenticated
  using (
    public.my_org_role() = 'director'
    and org_id = public.my_org_id()
    and role in ('stratege', 'monteur')
  )
  with check (
    public.my_org_role() = 'director'
    and org_id = public.my_org_id()
    and role in ('stratege', 'monteur')
  );

drop policy if exists "invitations: hierarchy insert" on public.invitations;
create policy "invitations: hierarchy insert"
  on public.invitations for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.can_manage_role(public.my_org_role(), role)
  );

drop policy if exists "invitations: hierarchy delete" on public.invitations;
create policy "invitations: hierarchy delete"
  on public.invitations for delete to authenticated
  using (public.my_org_role() = 'director' and org_id = public.my_org_id());

drop policy if exists "clients: team read" on public.clients;
create policy "clients: team read"
  on public.clients for select to authenticated
  using (
    public.my_org_role() in ('stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

drop policy if exists "projects: team read" on public.projects;
create policy "projects: team read"
  on public.projects for select to authenticated
  using (
    public.my_org_role() in ('stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

drop policy if exists "content: team read" on public.content_pieces;
create policy "content: team read"
  on public.content_pieces for select to authenticated
  using (
    public.my_org_role() in ('stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

drop policy if exists "content: org members update" on public.content_pieces;
create policy "content: org members update"
  on public.content_pieces for update to authenticated
  using (
    public.my_org_role() in ('director', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  )
  with check (
    public.my_org_role() in ('director', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  );

drop policy if exists "content: org members insert" on public.content_pieces;
create policy "content: org members insert"
  on public.content_pieces for insert to authenticated
  with check (
    public.my_org_role() in ('director', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  );

drop policy if exists "content: org members delete" on public.content_pieces;
create policy "content: org members delete"
  on public.content_pieces for delete to authenticated
  using (
    public.my_org_role() in ('director', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('team_memberships', 'org_members', 'invitations', 'clients', 'projects', 'content_pieces', 'tasks', 'time_entries')
order by tablename, policyname;
