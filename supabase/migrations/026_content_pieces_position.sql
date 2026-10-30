-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 026 : Colonne position pour le drag-and-drop des concepts
-- ══════════════════════════════════════════════════════════════════════════════
-- Ajoute une colonne "position" (integer) sur content_pieces pour permettre au
-- module concepts de la fiche client de réordonner les concepts par drag-and-drop
-- (dnd-kit côté front). Backfill des lignes existantes par ordre de création,
-- partitionné par client_id (chaque client a sa propre séquence 0..n).
-- Aucune policy RLS à ajouter : les policies existantes ("content: owner all",
-- "portal client update notes", etc.) s'appliquent au niveau de la ligne, pas
-- de la colonne.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.content_pieces add column if not exists position integer;

with ranked as (
  select id, row_number() over (partition by client_id order by created_at asc) - 1 as rn
  from public.content_pieces
)
update public.content_pieces cp
set position = ranked.rn
from ranked
where cp.id = ranked.id
  and cp.position is null;

alter table public.content_pieces alter column position set default 0;
alter table public.content_pieces alter column position set not null;

create index if not exists content_pieces_client_position_idx
  on public.content_pieces (client_id, position);

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select client_id, id, title, position, created_at
from public.content_pieces
order by client_id, position
limit 50;
