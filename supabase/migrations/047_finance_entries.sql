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
-- Nommage "finance_revenues" / "finance_expenses" (et non "revenues" /
-- "expenses") : une table "expenses" existe déjà depuis la migration
-- 002_finance.sql (module legacy, policies encore actives — 006/008/009/023),
-- ce qui faisait échouer cette migration avec "relation expenses already
-- exists". On ne touche ni ne supprime cette ancienne table/ses données —
-- aucun code applicatif actuel ne la lit (vérifié), elle reste en place
-- intacte, simplement ignorée par ce nouveau module.
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

create table public.finance_revenues (
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

create table public.finance_expenses (
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

create index finance_revenues_user_date_idx  on public.finance_revenues  (user_id, entry_date);
create index finance_expenses_user_date_idx  on public.finance_expenses  (user_id, entry_date);

alter table public.finance_revenues enable row level security;
alter table public.finance_expenses enable row level security;

-- ── finance_revenues ─────────────────────────────────────────────────────────

create policy "finance_revenues: owner all"
  on public.finance_revenues for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "finance_revenues: director read"
  on public.finance_revenues for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_revenues: director insert"
  on public.finance_revenues for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_revenues: director update"
  on public.finance_revenues for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_revenues: director delete"
  on public.finance_revenues for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- ── finance_expenses ─────────────────────────────────────────────────────────

create policy "finance_expenses: owner all"
  on public.finance_expenses for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "finance_expenses: director read"
  on public.finance_expenses for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_expenses: director insert"
  on public.finance_expenses for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_expenses: director update"
  on public.finance_expenses for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "finance_expenses: director delete"
  on public.finance_expenses for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- Aucun "grant ... to anon" ici, volontairement — cf. en-tête. Les tables
-- héritent du privilège par défaut "authenticated" déjà en place sur le
-- schéma public (même mécanisme que client_platform_access, migration 030,
-- qui n'a elle non plus aucun grant explicite).

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('finance_revenues', 'finance_expenses')
order by tablename, policyname;
