-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 020 : Notes personnelles (bloc "Mon espace" du owner)
-- ══════════════════════════════════════════════════════════════════════════════
-- Une note texte libre par utilisateur, éditable depuis /dashboard/mon-espace.
-- Pas de partage : chacun ne lit/écrit que sa propre ligne.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.user_notes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.user_notes enable row level security;

drop policy if exists "user_notes: owner access" on public.user_notes;

create policy "user_notes: owner access"
  on public.user_notes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists user_notes_updated_at on public.user_notes;
create trigger user_notes_updated_at
  before update on public.user_notes
  for each row execute procedure public.handle_updated_at();
