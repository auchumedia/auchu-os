-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 032 : Complète 031 — le bucket "client-documents" n'a pas été créé
-- ══════════════════════════════════════════════════════════════════════════════
-- Constaté en prod : la table client_documents et ses policies existent bien,
-- mais storage.buckets ne contient pas 'client-documents' (GET
-- /storage/v1/bucket/client-documents → 404 "Bucket not found"). Signe d'une
-- migration 031 interrompue avant sa fin (par ex. relancée une 2e fois après
-- un premier succès partiel : `create table` sans `if not exists` aurait fait
-- échouer tout le bloc `begin/commit` avant d'atteindre l'insert du bucket).
--
-- Idempotente de bout en bout (safe à ré-exécuter) pour ne plus jamais
-- dépendre de l'ordre d'exécution précédent.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.client_documents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  storage_path  text not null,
  file_size     bigint,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);

alter table public.client_documents enable row level security;

drop policy if exists "documents: owner all"      on public.client_documents;
drop policy if exists "documents: director read"  on public.client_documents;
drop policy if exists "documents: director insert" on public.client_documents;
drop policy if exists "documents: director delete" on public.client_documents;

create policy "documents: owner all"
  on public.client_documents for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "documents: director read"
  on public.client_documents for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "documents: director insert"
  on public.client_documents for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "documents: director delete"
  on public.client_documents for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- ── Storage bucket (privé) — la partie qui manquait ─────────────────────────

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

drop policy if exists "owner manage client-documents storage"    on storage.objects;
drop policy if exists "director manage client-documents storage" on storage.objects;

create policy "owner manage client-documents storage"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "director manage client-documents storage"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and public.my_org_role() = 'director'
    and ((storage.foldername(name))[1])::uuid in (select public.my_org_owner_ids())
  )
  with check (
    bucket_id = 'client-documents'
    and public.my_org_role() = 'director'
    and ((storage.foldername(name))[1])::uuid in (select public.my_org_owner_ids())
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select id, name, public from storage.buckets where id = 'client-documents';

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'client_documents'
order by policyname;

select policyname, roles, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%client-documents%'
order by policyname;
