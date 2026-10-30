-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 031 : Documents client (contrats, briefs) — table + bucket privé
-- ══════════════════════════════════════════════════════════════════════════════
-- Bucket privé (public = false) : contrairement à client-logos, ces PDF ne
-- doivent jamais être accessibles par URL publique — le téléchargement passe
-- par une signed URL générée à la demande côté API, après vérification du
-- rôle (owner/director uniquement, même périmètre que client_platform_access).
--
-- Convention de chemin : {owner_id}/{client_id}/{timestamp}_{filename} — le
-- 1er segment sert de clé RLS storage (comme client-logos), mais désigne
-- toujours l'ID du OWNER de l'org, pas celui de la personne qui upload,
-- pour que la policy "director" puisse matcher via my_org_owner_ids().
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table public.client_documents (
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

-- ── Storage bucket (privé) ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

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
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'client_documents'
order by policyname;

select id, name, public from storage.buckets where id = 'client-documents';
