-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 033 : Garantie défensive de l'unicité client_platform_access
-- ══════════════════════════════════════════════════════════════════════════════
-- "Cannot coerce the result to a single JSON object" (PGRST116) remonté sur
-- la sauvegarde de la Vue d'ensemble — cette erreur PostgREST signifie que
-- .single()/.maybeSingle() a reçu 0 ou 2+ lignes au lieu d'exactement 1.
-- Le suspect le plus probable est le PATCH de "Accès plateformes"
-- (upsert(..., { onConflict: 'client_id' }).select().single()) : s'il existe
-- plusieurs lignes pour un même client_id — via une contrainte unique qui
-- n'aurait pas pris comme pour le bucket 'client-documents' (031/032) — le
-- select() post-upsert peut en retourner plus d'une.
--
-- Idempotente : dédoublonne (garde la ligne la plus récente par client_id)
-- puis réaffirme la contrainte unique, que 030 l'ait ou non correctement
-- appliquée.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

delete from public.client_platform_access a
using public.client_platform_access b
where a.client_id = b.client_id
  and a.id <> b.id
  and (a.updated_at, a.id) < (b.updated_at, b.id);

alter table public.client_platform_access
  drop constraint if exists client_platform_access_client_id_key;

alter table public.client_platform_access
  add constraint client_platform_access_client_id_key unique (client_id);

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select client_id, count(*) as nb_lignes
from public.client_platform_access
group by client_id
having count(*) > 1;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.client_platform_access'::regclass
  and conname = 'client_platform_access_client_id_key';
