-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 041 : Les membres actifs de l'org peuvent supprimer des concepts
-- ══════════════════════════════════════════════════════════════════════════════
-- Jusqu'ici, DELETE sur content_pieces n'était permis qu'au owner
-- ("content: owner all", using auth.uid() = user_id). L'API route
-- (api/contenus/[id] DELETE) filtrait en plus sur .eq('user_id', dataOwnerId)
-- côté app, mais même avec ce filtre correct, la RLS bloquait silencieusement
-- le DELETE pour tout director/chef_equipe/stratege/monteur : 0 ligne
-- supprimée, aucune erreur PostgREST (delete sur 0 ligne n'est pas un échec),
-- donc la route répondait 200 alors que rien n'avait été supprimé — d'où le
-- concept qui "revient" après un refresh.
--
-- Cette policy est additive (permissive, OR'ée avec "content: owner all") et
-- symétrique à "content: org members update" (028) et "content: org members
-- insert" (040) : même whitelist de rôles, même condition
-- user_id in (select my_org_owner_ids()).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "content: org members delete" on public.content_pieces;

create policy "content: org members delete"
  on public.content_pieces for delete to authenticated
  using (
    public.my_org_role() in ('director', 'chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'content_pieces'
order by policyname;
