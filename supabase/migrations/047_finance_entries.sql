-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 047 : Finances internes (revenus / dépenses) — owner + director
-- ══════════════════════════════════════════════════════════════════════════════
-- Nouvelle section "Finances" du tableau de bord (owner/director uniquement).
-- Même pattern que client_platform_access (migration 030) : accès restreint
-- à owner + director via my_org_role()/my_org_owner_ids() (SECURITY DEFINER,
-- migrations 009/021 — pas de récursion RLS). stratege/monteur n'ont NI
-- lecture NI écriture, et AUCUN grant anon n'est posé sur ces deux tables —
-- elles restent invisibles même via l'API REST Supabase avec la clé anon.
--
-- user_id = toujours l'id du propriétaire de l'org (= dataOwnerId côté
-- application), jamais l'id du membre qui saisit l'entrée — même convention
-- que toutes les autres tables de données (clients, tasks, content_pieces).
--
-- "source" / "external_id" préparent une future intégration QuickBooks (ou
-- autre) sans migration supplémentaire : 'manual' par défaut pour les
-- entrées saisies à la main, external_id pour dédupliquer un import.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table public.revenues (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete set null,
  amount      numeric(12,2) not null,
  entry_date  date not null,
  description text,
  source      text not null default 'manual',
  external_id text,
  created_at  timestamptz default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  category    text not null,
  amount      numeric(12,2) not null,
  entry_date  date not null,
  description text,
  source      text not null default 'manual',
  external_id text,
  created_at  timestamptz default now()
);

create index revenues_user_date_idx  on public.revenues  (user_id, entry_date);
create index expenses_user_date_idx  on public.expenses  (user_id, entry_date);

alter table public.revenues enable row level security;
alter table public.expenses enable row level security;

-- ── revenues ───────────────────────────────────────────────────────────────────

create policy "revenues: owner all"
  on public.revenues for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "revenues: director read"
  on public.revenues for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "revenues: director insert"
  on public.revenues for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "revenues: director update"
  on public.revenues for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "revenues: director delete"
  on public.revenues for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- ── expenses ───────────────────────────────────────────────────────────────────

create policy "expenses: owner all"
  on public.expenses for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses: director read"
  on public.expenses for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "expenses: director insert"
  on public.expenses for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "expenses: director update"
  on public.expenses for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "expenses: director delete"
  on public.expenses for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- Aucun "grant ... to anon" ici, volontairement — cf. en-tête. Les tables
-- héritent du privilège par défaut "authenticated" déjà en place sur le
-- schéma public (même mécanisme que client_platform_access, migration 030,
-- qui n'a elle non plus aucun grant explicite).

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('revenues', 'expenses')
order by tablename, policyname;
