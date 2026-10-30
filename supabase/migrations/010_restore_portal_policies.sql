-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 010 : Restauration des policies anon du portail client
-- ══════════════════════════════════════════════════════════════════════════════
-- Les migrations 006-009 ciblaient des noms de policies précis et n'auraient
-- pas dû supprimer les policies portail. Cette migration les recrée de façon
-- idempotente pour garantir qu'elles existent et qu'elles n'utilisent que
-- portal_token (sans fonctions org ni références à org_members).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Grants explicites anon (sécurité : SELECT autorisé avant RLS) ─────────────
grant select on public.clients         to anon;
grant select on public.projects        to anon;
grant select on public.invoices        to anon;
grant select on public.content_pieces  to anon;
grant select on public.calendar_events to anon;

-- ── clients ───────────────────────────────────────────────────────────────────
drop policy if exists "portal public read clients" on public.clients;

create policy "portal public read clients"
  on public.clients for select
  to anon
  using (portal_enabled = true and portal_token is not null);

-- ── projects ──────────────────────────────────────────────────────────────────
drop policy if exists "portal public read projects" on public.projects;

create policy "portal public read projects"
  on public.projects for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

-- ── invoices ──────────────────────────────────────────────────────────────────
drop policy if exists "portal public read invoices" on public.invoices;

create policy "portal public read invoices"
  on public.invoices for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

-- ── content_pieces ────────────────────────────────────────────────────────────
drop policy if exists "portal public read content"       on public.content_pieces;
drop policy if exists "portal client update notes"       on public.content_pieces;

create policy "portal public read content"
  on public.content_pieces for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

create policy "portal client update notes"
  on public.content_pieces for update
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  )
  with check (true);

-- ── calendar_events ───────────────────────────────────────────────────────────
drop policy if exists "portal public read calendar events" on public.calendar_events;

create policy "portal public read calendar events"
  on public.calendar_events for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and (roles::text like '%anon%' or policyname like '%portal%')
order by tablename, policyname;
