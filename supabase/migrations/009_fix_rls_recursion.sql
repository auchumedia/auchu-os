-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 009 : Correction récursion infinie dans les policies RLS
-- ══════════════════════════════════════════════════════════════════════════════
-- Cause : "org_members: member reads roster" se référençait elle-même.
-- Fix   : fonctions SECURITY DEFINER qui lisent org_members sans RLS,
--         utilisées dans toutes les policies qui référencent org_members.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fonctions SECURITY DEFINER (contournent RLS) ──────────────────────────

-- org_ids des orgs où l'utilisateur courant est membre actif
create or replace function public.my_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.org_members
  where user_id = auth.uid() and status = 'actif'
$$;

-- owner_ids des orgs où l'utilisateur courant est membre actif (pour "member read")
create or replace function public.my_org_owner_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select o.owner_id
  from public.org_members om
  join public.organizations o on o.id = om.org_id
  where om.user_id = auth.uid() and om.status = 'actif'
$$;

-- owner_ids des orgs où l'utilisateur courant est manager actif (finance)
create or replace function public.my_managed_org_owner_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select o.owner_id
  from public.org_members om
  join public.organizations o on o.id = om.org_id
  where om.user_id = auth.uid() and om.status = 'actif' and om.role = 'manager'
$$;

-- ── 2. Policies organizations ─────────────────────────────────────────────────

drop policy if exists "org: owner full access" on public.organizations;
drop policy if exists "org: member read"       on public.organizations;

create policy "org: owner full access"
  on public.organizations for all
  using (owner_id = auth.uid());

-- Utilise my_org_ids() pour éviter la chaîne org → org_members → org → ∞
create policy "org: member read"
  on public.organizations for select
  using (id in (select public.my_org_ids()));

-- ── 3. Policies org_members ───────────────────────────────────────────────────

drop policy if exists "org_members: owner manages"       on public.org_members;
drop policy if exists "org_members: member reads roster" on public.org_members;

-- owner_manages interroge organizations → "org: owner full access" (auth.uid() = owner_id)
-- Pas de récursion car cette policy n'interroge pas org_members
create policy "org_members: owner manages"
  on public.org_members for all
  using (
    org_id in (select id from public.organizations where owner_id = auth.uid())
  );

-- Utilise my_org_ids() pour éviter l'auto-référence
create policy "org_members: member reads roster"
  on public.org_members for select
  using (org_id in (select public.my_org_ids()));

-- ── 4. Policies invitations ───────────────────────────────────────────────────

drop policy if exists "invitations: owner manages"     on public.invitations;
drop policy if exists "invitations: public read active" on public.invitations;

create policy "invitations: owner manages"
  on public.invitations for all
  using (
    org_id in (select id from public.organizations where owner_id = auth.uid())
  );

create policy "invitations: public read active"
  on public.invitations for select
  using (used_at is null and expires_at > now());

-- ── 5. Policies tables de données (my_org_owner_ids brise la récursion) ──────

-- clients
drop policy if exists "users own clients"    on public.clients;
drop policy if exists "clients: owner all"   on public.clients;
drop policy if exists "clients: member read" on public.clients;

create policy "clients: owner all"
  on public.clients for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "clients: member read"
  on public.clients for select to authenticated
  using (user_id in (select public.my_org_owner_ids()));

-- projects
drop policy if exists "users own projects"    on public.projects;
drop policy if exists "projects: owner all"   on public.projects;
drop policy if exists "projects: member read" on public.projects;

create policy "projects: owner all"
  on public.projects for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects: member read"
  on public.projects for select to authenticated
  using (user_id in (select public.my_org_owner_ids()));

-- content_pieces
drop policy if exists "users own content"               on public.content_pieces;
drop policy if exists "content: owner all"              on public.content_pieces;
drop policy if exists "content: member read"            on public.content_pieces;
drop policy if exists "content: editor update assigned" on public.content_pieces;

create policy "content: owner all"
  on public.content_pieces for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "content: member read"
  on public.content_pieces for select to authenticated
  using (user_id in (select public.my_org_owner_ids()));

create policy "content: editor update assigned"
  on public.content_pieces for update to authenticated
  using (assigned_user_id = auth.uid());

-- team_members
drop policy if exists "users own team_members"    on public.team_members;
drop policy if exists "team_members: owner all"   on public.team_members;
drop policy if exists "team_members: member read" on public.team_members;

create policy "team_members: owner all"
  on public.team_members for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "team_members: member read"
  on public.team_members for select to authenticated
  using (user_id in (select public.my_org_owner_ids()));

-- calendar_events
drop policy if exists "users manage own calendar events" on public.calendar_events;
drop policy if exists "calendar: owner all"              on public.calendar_events;
drop policy if exists "calendar: member read"            on public.calendar_events;

create policy "calendar: owner all"
  on public.calendar_events for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "calendar: member read"
  on public.calendar_events for select to authenticated
  using (user_id in (select public.my_org_owner_ids()));

-- invoices (manager uniquement via my_managed_org_owner_ids)
drop policy if exists "users own invoices"     on public.invoices;
drop policy if exists "invoices: owner all"    on public.invoices;
drop policy if exists "invoices: manager read" on public.invoices;

create policy "invoices: owner all"
  on public.invoices for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "invoices: manager read"
  on public.invoices for select to authenticated
  using (user_id in (select public.my_managed_org_owner_ids()));

-- expenses (manager uniquement)
drop policy if exists "users own expenses"     on public.expenses;
drop policy if exists "expenses: owner all"    on public.expenses;
drop policy if exists "expenses: manager read" on public.expenses;

create policy "expenses: owner all"
  on public.expenses for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses: manager read"
  on public.expenses for select to authenticated
  using (user_id in (select public.my_managed_org_owner_ids()));

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
