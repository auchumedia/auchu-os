-- ─── Extend clients with visual identity + portal ────────────────────────────
alter table public.clients
  add column if not exists logo_url        text,
  add column if not exists brand_primary   text not null default '#6366f1',
  add column if not exists brand_secondary text not null default '#f95640',
  add column if not exists portal_token    text unique,
  add column if not exists portal_enabled  boolean not null default false,
  add column if not exists internal_notes  text;

-- ─── Supabase Storage bucket for client logos ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

-- Storage RLS policies
create policy "owner upload logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos publicly readable"
  on storage.objects for select
  using (bucket_id = 'client-logos');

create policy "owner update logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── Public portal RLS policies ───────────────────────────────────────────────
-- Allows unauthenticated reads when portal_enabled = true (token = auth)
create policy "portal public read clients"
  on public.clients for select
  to anon
  using (portal_enabled = true and portal_token is not null);

create policy "portal public read projects"
  on public.projects for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

create policy "portal public read invoices"
  on public.invoices for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );

create policy "portal public read content"
  on public.content_pieces for select
  to anon
  using (
    client_id in (
      select id from public.clients
      where portal_enabled = true and portal_token is not null
    )
  );
