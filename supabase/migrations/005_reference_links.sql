-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 005 : reference_links sur content_pieces
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.content_pieces
  add column if not exists reference_links jsonb not null default '[]'::jsonb;

-- Vérification
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'content_pieces'
  and column_name  = 'reference_links';
