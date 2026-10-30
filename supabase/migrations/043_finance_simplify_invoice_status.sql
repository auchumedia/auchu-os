-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 043 : Simplification du module Finance — statuts de facture
-- ══════════════════════════════════════════════════════════════════════════════
-- Le module Finance ne garde que 3 statuts de facture client : envoye, paye,
-- en_retard. "draft" (brouillon) et "annule" sont retirés — toute facture est
-- désormais créée directement au statut "envoye". Les factures existantes en
-- draft/annule sont migrées vers "envoye" plutôt que supprimées, pour ne
-- perdre aucune donnée déjà saisie.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

update public.invoices
  set status = 'envoye'
  where status in ('draft', 'annule');

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check check (status in ('envoye', 'paye', 'en_retard'));

alter table public.invoices
  alter column status set default 'envoye';

commit;
