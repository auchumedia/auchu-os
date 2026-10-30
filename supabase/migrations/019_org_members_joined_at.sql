-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 019 : Ajouter joined_at à org_members si absent
-- ══════════════════════════════════════════════════════════════════════════════
-- Cause : migration 006 utilise CREATE TABLE IF NOT EXISTS. Si org_members
-- existait déjà dans le projet avant l'écriture des migrations, la colonne
-- joined_at n'a jamais été créée. L'ORDER BY joined_at dans la page équipe
-- retourne alors une 400 PostgREST, silencieusement interprétée comme 0 membres.
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.org_members
  add column if not exists joined_at timestamptz default now();

-- Backfill : les lignes existantes obtiennent l'heure courante
-- (pas idéal mais préférable à NULL)
update public.org_members
  set joined_at = now()
  where joined_at is null;

-- Vérification
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'org_members'
  and column_name  = 'joined_at';
