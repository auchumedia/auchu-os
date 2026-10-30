-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 040 : Les membres actifs de l'org peuvent créer des concepts
-- ══════════════════════════════════════════════════════════════════════════════
-- Jusqu'ici, INSERT sur content_pieces n'était permis qu'au owner
-- ("content: owner all", using/with check auth.uid() = user_id). L'API route
-- (api/contenus POST) insérait donc avec user_id = auth.uid() du créateur pour
-- que la policy passe — mais content_pieces.user_id doit toujours être l'ID
-- du owner de l'org (comme pour tous les reads et pour l'UPDATE, cf. migration
-- 028). Résultat : un director/chef_equipe/stratege/monteur pouvait créer un
-- contenu, mais la ligne héritait de son propre id et devenait invisible
-- partout ailleurs dans l'app (owner inclus), tous les reads filtrant sur
-- l'owner_id réel de l'org.
--
-- Cette policy est additive (permissive, OR'ée avec "content: owner all") et
-- symétrique à "content: org members update" (migration 028) : même whitelist
-- de rôles, même condition user_id in (select my_org_owner_ids()).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "content: org members insert" on public.content_pieces;

create policy "content: org members insert"
  on public.content_pieces for insert to authenticated
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
