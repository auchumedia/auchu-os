-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 039 : Pause du chrono + ajout manuel de temps
-- ══════════════════════════════════════════════════════════════════════════════
-- Étend time_entries (038) sans casser le modèle existant :
--
--   started_at          — inchangé, reste le vrai début de la session (figé,
--                         ne bouge plus à chaque reprise — utilisé pour
--                         l'historique/la date affichée).
--   segment_started_at   — début du segment EN COURS (nul = en pause ou
--                         arrêtée). C'est ce qui bouge à chaque "reprendre".
--   accumulated_seconds  — secondes cumulées des segments déjà complétés
--                         (mis à jour à chaque pause/arrêt).
--   entry_type           — 'timer' (chrono) ou 'manual' (ajout manuel).
--   note                  — note libre, utilisée surtout par les entrées
--                         manuelles (ex: "Tournage Cardinal Asphalte").
--
-- États d'une entrée :
--   en cours  : ended_at is null AND segment_started_at is not null
--   en pause  : ended_at is null AND segment_started_at is null
--   arrêtée   : ended_at is not null (duration_seconds fixé, segment_started_at null)
--
-- L'index unique partiel "une entrée active par utilisateur" (038,
-- `where ended_at is null`) continue de couvrir en-pause + en-cours — on ne
-- peut donc toujours démarrer qu'UNE session à la fois (running ou pausée),
-- inchangé.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.time_entries
  add column if not exists segment_started_at timestamptz,
  add column if not exists accumulated_seconds integer not null default 0,
  add column if not exists entry_type text not null default 'timer' check (entry_type in ('timer', 'manual')),
  add column if not exists note text;

-- Backfill : toute entrée déjà active (ended_at is null) sous l'ancien schéma
-- tournait forcément — son segment en cours a démarré à started_at, et elle
-- n'avait encore aucun segment complété (accumulated_seconds reste à 0).
update public.time_entries
  set segment_started_at = started_at
  where ended_at is null and segment_started_at is null;

alter table public.time_entries drop constraint if exists time_entries_no_segment_when_stopped;
alter table public.time_entries add constraint time_entries_no_segment_when_stopped
  check (ended_at is null or segment_started_at is null);

alter table public.time_entries drop constraint if exists time_entries_accumulated_nonneg;
alter table public.time_entries add constraint time_entries_accumulated_nonneg
  check (accumulated_seconds >= 0);

commit;
