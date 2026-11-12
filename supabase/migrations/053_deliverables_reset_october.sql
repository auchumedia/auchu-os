-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 053 : Repartir à zéro — tous les contacts démarrent en octobre 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- Remplace la migration 052 (supprimée — plus nécessaire). Ne supprime AUCUN
-- content_piece : tout l'historique reste en base, simplement ignoré par le
-- calcul des livrables (src/lib/deliverables.ts) puisqu'il est antérieur au
-- nouveau mois de départ.
--
-- a) colonnes d'ajustement manuel (reprend la migration 051 — idempotent)
-- b) deliverables_start_month = 2026-10-01 pour TOUS les contacts
-- c) tous les ajustements manuels remis à 0 et leurs notes vidées
-- d) vérification finale
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- a) Colonnes d'ajustement manuel (si pas déjà créées par la migration 051)
alter table public.clients
  add column if not exists deliverables_short_adjustment      integer not null default 0,
  add column if not exists deliverables_short_adjustment_note text,
  add column if not exists deliverables_long_adjustment       integer not null default 0,
  add column if not exists deliverables_long_adjustment_note  text;

comment on column public.clients.deliverables_short_adjustment is
  'Ajustement manuel (+ ou -) ajouté au solde cumulé des livrables short_form. Voir deliverables_short_adjustment_note.';
comment on column public.clients.deliverables_long_adjustment is
  'Ajustement manuel (+ ou -) ajouté au solde cumulé des livrables long_form. Voir deliverables_long_adjustment_note.';

-- b) Tous les contacts repartent à zéro au 1er octobre 2026
update public.clients
  set deliverables_start_month = '2026-10-01';

-- c) Tous les ajustements manuels remis à zéro (Cardinal Asphalte et
--    Nor-Can inclus — ils n'en ont plus besoin, le nouveau départ suffit)
update public.clients
  set deliverables_short_adjustment      = 0,
      deliverables_short_adjustment_note = null,
      deliverables_long_adjustment       = 0,
      deliverables_long_adjustment_note  = null;

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select
  name,
  deliverables_start_month,
  deliverables_short_adjustment, deliverables_short_adjustment_note,
  deliverables_long_adjustment,  deliverables_long_adjustment_note
from public.clients
order by name;
