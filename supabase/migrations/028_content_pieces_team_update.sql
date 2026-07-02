-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 028 : Les membres actifs de l'org peuvent modifier les concepts
-- ══════════════════════════════════════════════════════════════════════════════
-- Jusqu'ici, UPDATE sur content_pieces n'était permis qu'au owner
-- ("content: owner all") ou à la personne explicitement assignée via
-- assigned_user_id ("content: editor update assigned" — colonne jamais
-- alimentée par l'UI actuelle, qui utilise assigned_to en texte libre).
-- Résultat : un director/chef_equipe/stratege/monteur ne pouvait pas changer
-- le statut d'un concept qui ne lui était pas assigné, même si l'API route
-- filtrait correctement sur le bon owner_id.
--
-- Cette policy est additive (permissive, OR'ée avec les policies existantes)
-- et volontairement non restreinte par équipe/client — le besoin exprimé est
-- "tous les rôles de l'organisation", pas seulement l'équipe assignée au
-- client (contrairement aux policies SELECT "content: team read").
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "content: org members update" on public.content_pieces;

create policy "content: org members update"
  on public.content_pieces for update to authenticated
  using (
    public.my_org_role() in ('director', 'chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  )
  with check (
    public.my_org_role() in ('director', 'chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'content_pieces'
order by policyname;
