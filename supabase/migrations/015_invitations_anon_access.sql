-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 015 : Accès anon à la table invitations
-- Cause : le rôle anon n'avait pas le privilege SELECT → page /invite/[code]
--         retournait "Lien invalide" même pour une invitation valide.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Privilege SELECT pour le rôle anon
grant select on public.invitations to anon;

-- 2. Policy RLS explicite pour anon (la policy existante sans "to anon"
--    était ignorée faute de privilege)
drop policy if exists "invitations: public read by code" on public.invitations;

create policy "invitations: public read by code"
  on public.invitations
  for select
  to anon
  using (used_at is null and expires_at > now());
