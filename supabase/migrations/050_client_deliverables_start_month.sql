-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 050 : Mois de début des livrables — report automatique du retard
-- ══════════════════════════════════════════════════════════════════════════════
-- Nouvelle colonne sur clients : le mois (1er du mois) à partir duquel les
-- livrables mensuels (deliverables_short_form/long_form) commencent à être
-- dus pour ce contact. Nullable — quand elle est vide, l'application utilise
-- le mois de created_at (voir src/lib/deliverablesServer.ts).
--
-- Permet le calcul du retard/crédit cumulé par mois (tableau de bord —
-- carte "Livrables du mois", bande de chiffres clés) : voir
-- src/lib/deliverables.ts pour la formule de report.
--
-- Champ modifiable depuis la fiche client (onglet Vue d'ensemble) — RLS déjà
-- en place sur clients (owner/director en écriture, migrations 001/008/023),
-- aucune nouvelle policy nécessaire.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.clients
  add column if not exists deliverables_start_month date;

alter table public.clients
  add constraint clients_deliverables_start_month_first_of_month
  check (deliverables_start_month is null or extract(day from deliverables_start_month) = 1);

comment on column public.clients.deliverables_start_month is
  'Mois (1er du mois) à partir duquel les livrables mensuels sont dus. NULL = utiliser le mois de created_at.';

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
  and column_name = 'deliverables_start_month';
