-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 029 : Livrables du mois + liens plateformes sur les clients
-- ══════════════════════════════════════════════════════════════════════════════
-- Champs non sensibles, intentionnellement sur la table clients : le portail
-- lit déjà cette table en entier (select('*')) pour afficher "Contenu du
-- mois" et pourra désormais utiliser ces compteurs directement, au lieu de
-- calculer via scheduled_at sur content_pieces.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.clients
  add column if not exists deliverables_video_organique integer not null default 0,
  add column if not exists deliverables_story           integer not null default 0,
  add column if not exists deliverables_ad              integer not null default 0,
  add column if not exists link_instagram text,
  add column if not exists link_facebook text,
  add column if not exists link_tiktok   text,
  add column if not exists link_linkedin text;

alter table public.clients
  add constraint clients_deliverables_video_organique_check check (deliverables_video_organique >= 0),
  add constraint clients_deliverables_story_check           check (deliverables_story >= 0),
  add constraint clients_deliverables_ad_check               check (deliverables_ad >= 0);

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
  and column_name in (
    'deliverables_video_organique', 'deliverables_story', 'deliverables_ad',
    'link_instagram', 'link_facebook', 'link_tiktok', 'link_linkedin'
  )
order by column_name;
