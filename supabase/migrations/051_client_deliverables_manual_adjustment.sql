-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 051 : Ajustement manuel des livrables — par contact, par type
-- ══════════════════════════════════════════════════════════════════════════════
-- Un nombre entier (positif ou négatif) par type de livrable, qui s'ajoute
-- au solde cumulé (dû_cumulé − livré_cumulé) calculé par
-- src/lib/deliverables.ts. Positif = augmente le retard affiché ; négatif =
-- agit comme un crédit. Permet de corriger à la main les cas où l'historique
-- réel ne correspond pas exactement aux contenus enregistrés (changement de
-- forfait en cours de route, mois sans suivi, erreur passée déjà réglée
-- autrement...) sans avoir à modifier/inventer des content_pieces.
--
-- Champs modifiables depuis la fiche client (onglet Vue d'ensemble) — RLS
-- déjà en place sur clients (owner/director en écriture), aucune nouvelle
-- policy nécessaire.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.clients
  add column if not exists deliverables_short_adjustment      integer not null default 0,
  add column if not exists deliverables_short_adjustment_note text,
  add column if not exists deliverables_long_adjustment       integer not null default 0,
  add column if not exists deliverables_long_adjustment_note  text;

comment on column public.clients.deliverables_short_adjustment is
  'Ajustement manuel (+ ou -) ajouté au solde cumulé des livrables short_form. Voir deliverables_short_adjustment_note.';
comment on column public.clients.deliverables_long_adjustment is
  'Ajustement manuel (+ ou -) ajouté au solde cumulé des livrables long_form. Voir deliverables_long_adjustment_note.';

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
  and column_name in (
    'deliverables_short_adjustment', 'deliverables_short_adjustment_note',
    'deliverables_long_adjustment', 'deliverables_long_adjustment_note'
  )
order by column_name;
