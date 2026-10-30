-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 018 : Policy UPDATE sur invitations pour l'invité
-- ══════════════════════════════════════════════════════════════════════════════
-- Cause : "invitations: owner manages" (for all, migration 009) s'applique
-- aussi aux UPDATE. L'invité (non-owner) qui essaie de marquer used_at se
-- voit refuser le UPDATE par RLS → used_at reste NULL → l'invitation reste
-- visible dans "invitations en attente" même après que l'invité a rejoint.
--
-- Fix : policy UPDATE explicite utilisant my_org_ids() (SECURITY DEFINER)
-- pour permettre à un membre actif de marquer l'invitation de son org utilisée.
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "invitations: mark used by invitee" on public.invitations;

create policy "invitations: mark used by invitee"
  on public.invitations for update
  to authenticated
  using (
    -- Invitation encore active dans une org dont l'utilisateur est membre actif
    used_at is null
    and expires_at > now()
    and org_id in (select public.my_org_ids())
  )
  with check (
    -- L'invité ne peut qu'écrire son propre user_id dans used_by
    used_by = auth.uid()
  );

-- Vérification
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'invitations'
order by policyname;
