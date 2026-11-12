-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 052 : Correction de deliverables_start_month pour 3 contacts
-- ══════════════════════════════════════════════════════════════════════════════
-- deliverables_start_month était NULL pour tous les contacts (migration 050),
-- donc le calcul des livrables (src/lib/deliverables.ts) repliait sur le mois
-- de created_at — le mois d'ONBOARDING, pas le mois de première PRODUCTION.
-- Pour 3 contacts, l'écart entre les deux (quelques semaines en fin de mois)
-- créait un mois de quota fictif avant toute vraie production, et donc un
-- retard affiché qui n'a jamais existé dans les faits.
--
-- Vérifié contre les content_pieces réels de chaque contact (cf. rapport) —
-- ces 3 corrections suffisent À ELLES SEULES à reproduire exactement les
-- chiffres de novembre 2026 attendus, sans toucher à aucun content_piece :
--   • Bâton Rouge Vaudreuil : onboardé 27 août, 1re vidéo assignée à septembre.
--   • Groupe DDC             : onboardé 25 septembre, 1re vidéo assignée à octobre.
--   • Équipe Lemire Filion   : onboardé 15 septembre, 1re vidéo assignée à octobre.
--
-- Cardinal Asphalte et Nor-Can ne sont PAS inclus ici : leur écart ne peut
-- pas être résolu par un simple mois de départ (voir rapport — 5 pièces
-- "publie" de Cardinal sans month_target, et septembre 2026 entièrement vide
-- chez Nor-Can). Utiliser l'ajustement manuel (migration 051, champ
-- "Ajustement manuel" dans la fiche contact) en attendant une confirmation.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

update public.clients set deliverables_start_month = '2026-09-01'
  where id = '2e20cd09-e195-44ce-b1c9-84ff5238510c'; -- Bâton Rouge Vaudreuil

update public.clients set deliverables_start_month = '2026-10-01'
  where id = 'cd1ab6b9-16b6-45c9-9774-1557ff00861c'; -- Groupe DDC

update public.clients set deliverables_start_month = '2026-10-01'
  where id = '6de7858e-5f11-4743-ac27-a54fb5d84c87'; -- Équipe Lemire Filion

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select name, deliverables_start_month
from public.clients
where id in (
  '2e20cd09-e195-44ce-b1c9-84ff5238510c',
  'cd1ab6b9-16b6-45c9-9774-1557ff00861c',
  '6de7858e-5f11-4743-ac27-a54fb5d84c87'
)
order by name;

-- ══════════════════════════════════════════════════════════════════════════════
-- OPTIONNEL — Cardinal Asphalte et Nor-Can, SEULEMENT si vous confirmez le
-- diagnostic du rapport (mois de départ = juillet 2026, écart comblé par un
-- ajustement manuel en attendant que les content_pieces ambigus soient
-- corrigés). Ne pas exécuter sans avoir lu le rapport.
-- ══════════════════════════════════════════════════════════════════════════════

-- update public.clients set
--   deliverables_start_month = '2026-07-01',
--   deliverables_short_adjustment = 3,
--   deliverables_short_adjustment_note = '5 contenus publiés sans month_target (repli sur juillet, leur mois de création) — retard réel non capturé par les content_pieces. À retirer une fois ces 5 pièces réassignées au bon mois.'
--   where id = 'd8425d0d-5b13-444b-a225-1b1b20b810a0'; -- Cardinal Asphalte

-- update public.clients set
--   deliverables_start_month = '2026-07-01',
--   deliverables_short_adjustment = -3,
--   deliverables_short_adjustment_note = 'Septembre 2026 ne contient aucun content_piece (livré ou non) — écart probablement dû à du contenu non enregistré ce mois-là. À retirer une fois confirmé/corrigé.'
--   where id = 'e59732eb-fc7e-4043-8991-1ef140f276e4'; -- Nor-Can
