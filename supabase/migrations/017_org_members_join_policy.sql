-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 017 : Policy INSERT pour qu'un invité puisse rejoindre une org
-- ══════════════════════════════════════════════════════════════════════════════
-- Cause : "org_members: owner manages" (migration 009, for all) utilise son
-- "using" clause comme "with check" pour INSERT → seul le propriétaire peut
-- insérer des lignes. Un invité (non propriétaire) qui accepte une invitation
-- obtient une erreur RLS → le join ne fonctionne jamais.
--
-- Fix : ajouter une policy INSERT explicite qui permet à un utilisateur
-- authentifié de s'ajouter lui-même à une org qui a au moins une invitation
-- active non expirée. La validation du code spécifique reste dans le code
-- applicatif (route /api/invitations/join et /auth/callback).
-- ══════════════════════════════════════════════════════════════════════════════

-- Fonction SECURITY DEFINER : org_ids avec invitations actives (lit sans RLS)
create or replace function public.org_ids_with_active_invitation()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.invitations
  where used_at is null and expires_at > now()
$$;

-- Policy INSERT : un utilisateur peut s'ajouter lui-même à une org invitante
drop policy if exists "org_members: join via invitation" on public.org_members;

create policy "org_members: join via invitation"
  on public.org_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and org_id in (select public.org_ids_with_active_invitation())
  );

-- Vérification
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'org_members'
order by policyname;
