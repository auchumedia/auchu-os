-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 027 : Nouveau type "video_organique" + plateforme "toutes"
-- ══════════════════════════════════════════════════════════════════════════════
-- Le formulaire de création de concept est simplifié à 3 types (Vidéo
-- organique, Story, Ad) et une plateforme "Toutes les plateformes" par défaut.
-- Les anciennes valeurs (post, reel, script_video, caption, script, email,
-- google) restent acceptées pour ne pas casser les lignes existantes — même
-- convention additive que la migration 004_content_calendar.sql.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.content_pieces drop constraint if exists content_pieces_type_check;

alter table public.content_pieces
  add constraint content_pieces_type_check
  check (type in (
    'post', 'reel', 'story', 'script_video', 'ad', 'caption', 'script', 'email',
    'video_organique'
  ));

alter table public.content_pieces drop constraint if exists content_pieces_platform_check;

alter table public.content_pieces
  add constraint content_pieces_platform_check
  check (platform in (
    'instagram', 'facebook', 'tiktok', 'linkedin', 'google', 'meta', 'toutes'
  ));

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.content_pieces'::regclass
  and conname in ('content_pieces_type_check', 'content_pieces_platform_check');
