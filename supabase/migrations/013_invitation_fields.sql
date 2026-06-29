-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 013 : Colonnes invited_name + invited_email sur invitations
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.invitations
  add column if not exists invited_name  text,
  add column if not exists invited_email text;
