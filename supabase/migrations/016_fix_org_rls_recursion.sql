-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 016 : Fix récursion infinie (42P17) dans les policies organizations
-- ══════════════════════════════════════════════════════════════════════════════
-- Cause : "invitations: owner manages" (migration 009) n'a pas "to authenticated"
-- → anon évalue sa subquery sur organizations → déclenche "org: anon read via
-- portal" (migration 014) qui lit clients sans SECURITY DEFINER → chaîne pouvant
-- remonter jusqu'à organizations → 42P17.
--
-- Fix :
--   1. Deux fonctions SECURITY DEFINER pour les subqueries anon dans organizations
--   2. Reconstruire les policies organizations (disable → drop → enable → recreate)
--   3. Restreindre "invitations: owner manages" à authenticated seulement
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fonctions SECURITY DEFINER pour les accès anon ────────────────────────

-- Owner IDs des orgs ayant au moins un client portail actif (lit clients sans RLS)
create or replace function public.org_owner_ids_for_portal()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select user_id from public.clients where portal_enabled = true
$$;

-- Org IDs ayant des invitations actives non expirées (lit invitations sans RLS)
create or replace function public.org_ids_for_active_invitations()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.invitations
  where used_at is null and expires_at > now()
$$;

-- ── 2. Reconstruire les policies organizations sans récursion ─────────────────

alter table public.organizations disable row level security;

drop policy if exists "org: owner full access"        on public.organizations;
drop policy if exists "org: member read"              on public.organizations;
drop policy if exists "org: anon read via portal"     on public.organizations;
drop policy if exists "org: anon read via invitation" on public.organizations;

alter table public.organizations enable row level security;

-- Owner : accès complet (uniquement owner_id = auth.uid(), aucune jointure)
create policy "org: owner full access"
  on public.organizations for all
  to authenticated
  using (owner_id = auth.uid());

-- Membre : lecture via SECURITY DEFINER (pas de récursion — my_org_ids lit org_members directement)
create policy "org: member read"
  on public.organizations for select
  to authenticated
  using (id in (select public.my_org_ids()));

-- Anon : lecture pour portail client (SECURITY DEFINER → lit clients sans RLS, brise la chaîne)
create policy "org: anon read via portal"
  on public.organizations for select
  to anon
  using (owner_id in (select public.org_owner_ids_for_portal()));

-- Anon : lecture pour page d'invitation (SECURITY DEFINER → lit invitations sans RLS)
create policy "org: anon read via invitation"
  on public.organizations for select
  to anon
  using (id in (select public.org_ids_for_active_invitations()));

-- ── 3. Restreindre "invitations: owner manages" à authenticated ───────────────
-- Sans "to authenticated" cette policy s'applique à anon et force une lecture
-- de organizations en tant qu'anon → source de la chaîne récursive 42P17.

drop policy if exists "invitations: owner manages" on public.invitations;

create policy "invitations: owner manages"
  on public.invitations for all
  to authenticated
  using (
    org_id in (select id from public.organizations where owner_id = auth.uid())
  );

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('organizations', 'invitations')
order by tablename, policyname;
