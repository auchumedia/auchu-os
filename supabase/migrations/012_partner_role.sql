-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 012 : Rôle Partenaire + champ assigned_partner sur clients
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Champ assigned_partner sur clients ─────────────────────────────────────
alter table public.clients
  add column if not exists assigned_partner uuid references auth.users(id) on delete set null;

-- ── 2. Étendre le check de rôle dans org_members pour inclure 'partner' ───────
alter table public.org_members
  drop constraint if exists org_members_role_check;
alter table public.org_members
  add constraint org_members_role_check
  check (role in ('owner','manager','partner','editor','viewer'));

-- ── 3. Étendre le check de rôle dans invitations pour inclure 'partner' ───────
alter table public.invitations
  drop constraint if exists invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check
  check (role in ('manager','partner','editor','viewer'));

-- ── 4. Mettre à jour la policy "clients: member read" pour exclure partners ───
-- (les partners ont leur propre policy qui filtre par assigned_partner)
drop policy if exists "clients: member read" on public.clients;
create policy "clients: member read"
  on public.clients for select using (
    user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.status = 'actif'
        and om.role != 'partner'
    )
  );

-- ── 5. Policy partenaire : lecture des clients assignés uniquement ─────────────
drop policy if exists "clients: partner read assigned" on public.clients;
create policy "clients: partner read assigned"
  on public.clients for select using (
    assigned_partner = auth.uid()
    and user_id in (
      select o.owner_id
      from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.status = 'actif'
        and om.role = 'partner'
    )
  );
