-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 042 : nouveau workflow de statuts contenu + ciblage de mois
-- ══════════════════════════════════════════════════════════════════════════════
-- Onglet "Projets" (fusion Contenu + Calendrier) : les idées sont filtrées par
-- mois (scheduled_at, ou à défaut month_target, ou à défaut created_at).

-- ─── 1. Backfill des anciens statuts avant de resserrer la contrainte ─────────
-- 'draft' et 'review' sortent du workflow (idee/en_redaction/pret couvrent déjà
-- ces cas) — on migre les lignes existantes vers leur équivalent le plus proche.

update public.content_pieces set status = 'idee' where status = 'draft';
update public.content_pieces set status = 'pret'  where status = 'review';

-- ─── 2. Nouvelle contrainte CHECK ──────────────────────────────────────────────

do $$
begin
  alter table public.content_pieces
    drop constraint if exists content_pieces_status_check;
exception when others then null;
end $$;

alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in (
    'idee', 'en_redaction', 'pret', 'approuve', 'refuse', 'filme', 'publie'
  ));

-- ─── 3. Colonne month_target ───────────────────────────────────────────────────
-- Permet de rattacher explicitement une idée à un mois donné quand elle n'a pas
-- encore de scheduled_at (ex: planification d'un mois futur). Fallback appliqué
-- côté application : scheduled_at ?? month_target ?? created_at.

alter table public.content_pieces
  add column if not exists month_target date;

comment on column public.content_pieces.month_target is
  'Mois cible explicite pour l''onglet Projets quand scheduled_at est vide. Fallback : created_at.';
