-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 046 : Restreint le grant SELECT anon sur content_pieces au niveau
-- colonne.
-- ══════════════════════════════════════════════════════════════════════════════
-- Les migrations 004 et 010 font `grant select on content_pieces to anon`
-- (toutes les colonnes) : les policies RLS anon (migration 010, inchangées
-- ici) filtrent bien les LIGNES par client_id/portal_token, mais PostgreSQL
-- n'empêche pas une requête anon select('internal_notes') ou
-- select('assigned_to') de passer — ces colonnes internes à l'agence étaient
-- donc lisibles directement via l'API REST Supabase avec la seule clé anon
-- publique, même si le code applicatif ne les demande jamais.
--
-- On remplace le grant table-level par un grant colonne-level listant
-- EXACTEMENT les colonnes utilisées par le portail client, à savoir les
-- colonnes du select() de :
--   - src/app/portail/[token]/page.tsx
--   - src/app/api/portail/[token]/contenu/route.ts
--   - src/app/api/portail/[token]/contenu/[id]/route.ts
-- (les trois select() sont identiques). internal_notes, assigned_to,
-- assigned_user_id, variants et toute colonne future restent donc
-- inaccessibles à anon au niveau base de données, pas seulement par
-- convention applicative.
--
-- Le grant UPDATE anon (migration 004 : client_notes, status) n'est pas
-- touché — déjà restreint à ces deux colonnes, qui sont les seules que le
-- portail met à jour (PATCH /api/portail/[token]/contenu/[id]).
-- ══════════════════════════════════════════════════════════════════════════════

revoke select on public.content_pieces from anon;

grant select (
  id,
  client_id,
  user_id,
  project_id,
  title,
  type,
  platform,
  status,
  body,
  description,
  script,
  client_notes,
  reference_links,
  position,
  scheduled_at,
  month_target,
  published_at,
  ai_generated,
  created_at,
  updated_at
) on public.content_pieces to anon;

-- ── Vérification ──────────────────────────────────────────────────────────────
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'content_pieces'
  and grantee = 'anon'
order by column_name;
