-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 006 : Organisations, équipe, invitations, facturation
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Profiles (miroir auth.users pour les requêtes entre membres) ──────────────
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text,
  full_name  text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: authenticated read all"
  on public.profiles for select to authenticated using (true);

create policy "profiles: own update"
  on public.profiles for update using (id = auth.uid());

-- Trigger : créer le profil à chaque nouveau signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill des utilisateurs existants
insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ── Organizations ─────────────────────────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  plan        text not null default 'free'
              check (plan in ('free','starter','agence','pro')),
  max_members int  not null default 1,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.organizations enable row level security;

create policy "org: owner full access" on public.organizations
  for all using (owner_id = auth.uid());

create policy "org: member read" on public.organizations
  for select using (
    id in (
      select org_id from public.org_members
      where user_id = auth.uid() and status = 'actif'
    )
  );

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.handle_updated_at();

-- ── Org members ───────────────────────────────────────────────────────────────
create table public.org_members (
  id        uuid primary key default uuid_generate_v4(),
  org_id    uuid references public.organizations(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  role      text not null default 'editor'
            check (role in ('owner','manager','editor','viewer')),
  status    text not null default 'actif'
            check (status in ('actif','inactif')),
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "org_members: owner manages" on public.org_members
  for all using (
    org_id in (select id from public.organizations where owner_id = auth.uid())
  );

create policy "org_members: member reads roster" on public.org_members
  for select using (
    org_id in (
      select org_id from public.org_members om2
      where om2.user_id = auth.uid() and om2.status = 'actif'
    )
  );

-- ── Invitations ───────────────────────────────────────────────────────────────
create table public.invitations (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid references public.organizations(id) on delete cascade not null,
  code       text not null unique,
  role       text not null default 'editor'
             check (role in ('manager','editor','viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at    timestamptz,
  used_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.invitations enable row level security;

create policy "invitations: owner manages" on public.invitations
  for all using (
    org_id in (select id from public.organizations where owner_id = auth.uid())
  );

-- Code d'invitation lisible publiquement (code non-devinable, 7 jours max)
create policy "invitations: public read active" on public.invitations
  for select using (used_at is null and expires_at > now());

-- ── assigned_user_id sur content_pieces (liaison UUID ↔ membre) ───────────────
alter table public.content_pieces
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

-- ── Mise à jour des politiques RLS des tables existantes ─────────────────────
-- On conserve l'accès complet du propriétaire et on ajoute la lecture pour membres

-- clients
drop policy if exists "users own clients" on public.clients;
create policy "clients: owner all"   on public.clients for all    using (auth.uid() = user_id);
create policy "clients: member read" on public.clients for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif'
  )
);

-- projects
drop policy if exists "users own projects" on public.projects;
create policy "projects: owner all"   on public.projects for all    using (auth.uid() = user_id);
create policy "projects: member read" on public.projects for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif'
  )
);

-- content_pieces
drop policy if exists "users own content" on public.content_pieces;
create policy "content: owner all"   on public.content_pieces for all    using (auth.uid() = user_id);
create policy "content: member read" on public.content_pieces for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif'
  )
);
-- L'éditeur peut aussi mettre à jour le contenu qui lui est assigné
create policy "content: editor update assigned" on public.content_pieces for update using (
  assigned_user_id = auth.uid()
);

-- team_members (référentiel interne)
drop policy if exists "users own team_members" on public.team_members;
create policy "team_members: owner all"   on public.team_members for all    using (auth.uid() = user_id);
create policy "team_members: member read" on public.team_members for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif'
  )
);

-- invoices (finance : owner + manager uniquement)
drop policy if exists "users own invoices" on public.invoices;
create policy "invoices: owner all"     on public.invoices for all    using (auth.uid() = user_id);
create policy "invoices: manager read"  on public.invoices for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif' and om.role in ('manager')
  )
);

-- calendar_events
drop policy if exists "users own calendar_events" on public.calendar_events;
create policy "calendar: owner all"   on public.calendar_events for all    using (auth.uid() = user_id);
create policy "calendar: member read" on public.calendar_events for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif'
  )
);

-- expenses (si la table existe)
drop policy if exists "users own expenses" on public.expenses;
create policy "expenses: owner all"    on public.expenses for all    using (auth.uid() = user_id);
create policy "expenses: manager read" on public.expenses for select using (
  user_id in (
    select o.owner_id from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid() and om.status = 'actif' and om.role in ('manager')
  )
);

-- ── Vérification ──────────────────────────────────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','organizations','org_members','invitations');
