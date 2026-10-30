-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 014 : Paramètres organisation + profil + bucket Storage
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes organizations ──────────────────────────────────────────────────
alter table public.organizations
  add column if not exists logo_url         text,
  add column if not exists primary_color    text not null default '#4f46e5',
  add column if not exists secondary_color  text not null default '#7c3aed',
  add column if not exists email            text,
  add column if not exists phone            text,
  add column if not exists address_street   text,
  add column if not exists address_city     text,
  add column if not exists address_province text,
  add column if not exists address_postal   text,
  add column if not exists address_country  text not null default 'Canada',
  add column if not exists website          text;

-- ── 2. Colonnes profiles (avatar_url existe déjà) ─────────────────────────────
alter table public.profiles
  add column if not exists title text;

-- ── 3. Bucket Supabase Storage org-assets (public, 5 Mo, images seulement) ────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-assets',
  'org-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do nothing;

-- Policies Storage
drop policy if exists "org-assets: public read"          on storage.objects;
drop policy if exists "org-assets: authenticated upload" on storage.objects;
drop policy if exists "org-assets: owner update"         on storage.objects;
drop policy if exists "org-assets: owner delete"         on storage.objects;

create policy "org-assets: public read"
  on storage.objects for select
  using (bucket_id = 'org-assets');

create policy "org-assets: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'org-assets' and auth.role() = 'authenticated');

create policy "org-assets: owner update"
  on storage.objects for update
  using (bucket_id = 'org-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "org-assets: owner delete"
  on storage.objects for delete
  using (bucket_id = 'org-assets' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── 4. RLS : lecture anon de l'org via portail client ─────────────────────────
drop policy if exists "org: anon read via portal" on public.organizations;

create policy "org: anon read via portal"
  on public.organizations for select
  to anon
  using (
    owner_id in (
      select user_id from public.clients
      where portal_enabled = true
    )
  );
