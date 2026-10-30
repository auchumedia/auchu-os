-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 022 : Migration des données — anciens rôles → nouveaux rôles
-- ══════════════════════════════════════════════════════════════════════════════
-- À exécuter juste avant le déploiement du nouveau code (pas des jours avant :
-- entre 022 et le déploiement, les 2 comptes migrés ont un rôle que l'ancien
-- code ne reconnaît pas dans ses listes en dur).
--
-- PRÉ-VOL MANUEL (à lancer AVANT ce fichier, lecture seule) :
--
--   select id, user_id, role from public.org_members where role <> 'owner';
--
-- Doit renvoyer EXACTEMENT les 2 lignes ci-dessous (1f3a43d1… et d49fd37f…,
-- toutes deux role='manager'). Si d'autres lignes apparaissent (partner/
-- editor/viewer), NE PAS les migrer à l'aveugle — ce fichier les désactive
-- (status='inactif') au lieu de deviner un mapping, à réassigner manuellement.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- 1. Expirer les invitations en attente : leur `role` ne survivrait pas à la
--    nouvelle contrainte CHECK de la migration 023.
update public.invitations
  set used_at = now()
  where used_at is null and expires_at > now();

-- 2. Désactiver toute ligne org_members non prévue par cette migration
--    (garde-fou pour les rôles legacy 'partner'/'editor'/'viewer' imprévus).
update public.org_members
  set status = 'inactif'
  where role in ('partner', 'editor', 'viewer')
    and status = 'actif';

-- 3. Remap des 2 membres réels connus.
update public.org_members
  set role = 'chef_equipe'
  where user_id = '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149' and role = 'manager';

update public.org_members
  set role = 'director'
  where user_id = 'd49fd37f-be6f-40dd-9071-84a16155c4b5' and role = 'manager';

-- 4. Créer "Équipe 1" pour le nouveau chef_equipe, idempotent.
insert into public.teams (org_id, name, chef_id)
  select '45a621a5-01c8-4a7e-9c61-cb8878a73fff', 'Équipe 1', '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149'
  where not exists (
    select 1 from public.teams where chef_id = '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149'
  );

insert into public.team_memberships (team_id, user_id, role)
  select t.id, '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149', 'chef_equipe'
  from public.teams t
  where t.chef_id = '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149'
    and not exists (
      select 1 from public.team_memberships where user_id = '1f3a43d1-b9f9-4dac-aa1d-d7bd63924149'
    );

-- director (d49fd37f…) ne rejoint aucune équipe : il opère au-dessus de la
-- couche équipe, comme owner.

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select id, user_id, role, status from public.org_members where role <> 'owner';
select * from public.teams;
select * from public.team_memberships;
