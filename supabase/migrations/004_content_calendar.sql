-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 004 : table contenu enrichie + calendrier d'événements
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend content_pieces ─────────────────────────────────────────────────

alter table public.content_pieces
  add column if not exists description  text,
  add column if not exists script       text,
  add column if not exists assigned_to  text,
  add column if not exists client_notes text;

-- Update status check to include new values (keep old ones for compatibility)
do $$
begin
  alter table public.content_pieces
    drop constraint if exists content_pieces_status_check;
exception when others then null;
end $$;

alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in (
    'idee', 'en_redaction', 'pret', 'approuve', 'refuse',
    'draft', 'review', 'publie'
  ));

-- Update type check to include new values
do $$
begin
  alter table public.content_pieces
    drop constraint if exists content_pieces_type_check;
exception when others then null;
end $$;

alter table public.content_pieces
  add constraint content_pieces_type_check
  check (type in (
    'post', 'reel', 'story', 'script_video', 'ad',
    'story', 'caption', 'script', 'email'
  ));

-- ─── 2. calendar_events table ─────────────────────────────────────────────────

create table if not exists public.calendar_events (
  id                uuid        default gen_random_uuid() primary key,
  user_id           uuid        references auth.users(id) on delete cascade not null,
  client_id         uuid        references public.clients(id) on delete cascade not null,
  type              text        not null check (type in ('tournage', 'publication')),
  title             text        not null,
  date              date        not null,
  -- tournage specific
  location          text,
  participants      text[],
  -- publication specific
  platform          text,
  content_piece_id  uuid        references public.content_pieces(id) on delete set null,
  -- common
  notes             text,
  created_at        timestamptz default now()
);

alter table public.calendar_events enable row level security;

create policy "users manage own calendar events"
  on public.calendar_events for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "portal public read calendar events"
  on public.calendar_events for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

-- ─── 3. Allow portal clients to update their notes + approve/refuse ───────────

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_pieces'
    and policyname = 'portal client update notes'
  ) then
    execute $p$
      create policy "portal client update notes"
        on public.content_pieces for update
        to anon
        using (
          client_id in (
            select id from public.clients
            where portal_enabled = true and portal_token is not null
          )
        )
        with check (true)
    $p$;
  end if;
end $$;

-- ─── 4. Grants ────────────────────────────────────────────────────────────────

grant select on public.calendar_events to anon;
grant update (client_notes, status) on public.content_pieces to anon;

-- ─── 5. Vérification ──────────────────────────────────────────────────────────

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'content_pieces'
  and column_name  in ('description', 'script', 'assigned_to', 'client_notes')
order by column_name;
