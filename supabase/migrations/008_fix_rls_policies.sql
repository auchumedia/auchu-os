-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 008 : Correction et idempotence des policies RLS
-- ══════════════════════════════════════════════════════════════════════════════
-- Recrée toutes les policies owner/member sur les tables existantes.
-- Utiliser si les données ne s'affichent plus après migration 006.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Diagnostic : policies actives avant correction ────────────────────────────
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('clients','projects','content_pieces','team_members','invoices','expenses','calendar_events')
order by tablename, policyname;

-- ── clients ───────────────────────────────────────────────────────────────────
drop policy if exists "users own clients"    on public.clients;
drop policy if exists "clients: owner all"   on public.clients;
drop policy if exists "clients: member read" on public.clients;

create policy "clients: owner all"
  on public.clients for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "clients: member read"
  on public.clients for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
    )
  );

-- ── projects ──────────────────────────────────────────────────────────────────
drop policy if exists "users own projects"    on public.projects;
drop policy if exists "projects: owner all"   on public.projects;
drop policy if exists "projects: member read" on public.projects;

create policy "projects: owner all"
  on public.projects for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects: member read"
  on public.projects for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
    )
  );

-- ── content_pieces ────────────────────────────────────────────────────────────
drop policy if exists "users own content"               on public.content_pieces;
drop policy if exists "content: owner all"              on public.content_pieces;
drop policy if exists "content: member read"            on public.content_pieces;
drop policy if exists "content: editor update assigned" on public.content_pieces;

create policy "content: owner all"
  on public.content_pieces for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "content: member read"
  on public.content_pieces for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
    )
  );

create policy "content: editor update assigned"
  on public.content_pieces for update
  to authenticated
  using (assigned_user_id = auth.uid());

-- ── team_members ──────────────────────────────────────────────────────────────
drop policy if exists "users own team_members"    on public.team_members;
drop policy if exists "team_members: owner all"   on public.team_members;
drop policy if exists "team_members: member read" on public.team_members;

create policy "team_members: owner all"
  on public.team_members for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "team_members: member read"
  on public.team_members for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
    )
  );

-- ── invoices ──────────────────────────────────────────────────────────────────
drop policy if exists "users own invoices"     on public.invoices;
drop policy if exists "invoices: owner all"    on public.invoices;
drop policy if exists "invoices: manager read" on public.invoices;

create policy "invoices: owner all"
  on public.invoices for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "invoices: manager read"
  on public.invoices for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
        and om.role = 'manager'
    )
  );

-- ── expenses ──────────────────────────────────────────────────────────────────
drop policy if exists "users own expenses"     on public.expenses;
drop policy if exists "expenses: owner all"    on public.expenses;
drop policy if exists "expenses: manager read" on public.expenses;

create policy "expenses: owner all"
  on public.expenses for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses: manager read"
  on public.expenses for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
        and om.role = 'manager'
    )
  );

-- ── calendar_events ───────────────────────────────────────────────────────────
drop policy if exists "users manage own calendar events" on public.calendar_events;
drop policy if exists "calendar: owner all"              on public.calendar_events;
drop policy if exists "calendar: member read"            on public.calendar_events;

create policy "calendar: owner all"
  on public.calendar_events for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "calendar: member read"
  on public.calendar_events for select
  to authenticated
  using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid() and om.status = 'actif'
    )
  );

-- ── Vérification finale ───────────────────────────────────────────────────────
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('clients','projects','content_pieces','team_members','invoices','expenses','calendar_events')
order by tablename, policyname;
