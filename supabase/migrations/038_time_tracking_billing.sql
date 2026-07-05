-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 038 : Time tracking + facturation des membres sous-traitants
-- ══════════════════════════════════════════════════════════════════════════════
-- Trois tables additives, sans impact sur le schéma existant :
--
--   time_entries          — chronométrage par tâche. user_id = la personne qui
--                           chronométre (PAS un ancre de tenant — contrairement
--                           à tasks.user_id). Le tenant est dérivé via le join
--                           sur tasks.user_id dans les policies RLS ci-dessous.
--                           Une seule entrée active (ended_at is null) par
--                           utilisateur, imposé par un index unique partiel.
--
--   member_billing_config — profil de facturation d'un membre (taux horaire ou
--                           montant fixe, devise, période, infos de paiement).
--                           1 ligne par membre (primary key = user_id).
--
--   member_invoices        — factures soumises par les membres à l'organisation
--                           (distinct de "invoices", qui sont les factures de
--                           l'agence à SES clients). org_id (pas user_id) est
--                           l'ancre du tenant ici, car member_id ≠ owner.
--
-- Permissions :
--   - Un membre gère librement ses propres time_entries et sa propre config.
--   - Un membre crée/envoie ses propres factures (brouillon → envoyée) ; une
--     fois envoyée, seul owner/director peut la faire progresser (approuvée,
--     payée) ou la modifier — imposé par un trigger, défense en profondeur en
--     plus des policies RLS (même pattern que tasks_enforce_role_update, 035).
--   - owner/director/chef_equipe peuvent lire les time_entries de leur
--     org/équipe pour les rapports (Finance → "Factures membres").
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. time_entries ──────────────────────────────────────────────────────────

create table public.time_entries (
  id                uuid primary key default uuid_generate_v4(),
  task_id           uuid references public.tasks(id) on delete cascade not null,
  user_id           uuid references auth.users(id) on delete cascade not null,
  client_id         uuid references public.clients(id) on delete set null,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer,
  created_at        timestamptz default now(),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index time_entries_task_id_idx on public.time_entries(task_id);
create index time_entries_user_id_idx on public.time_entries(user_id);

-- Une seule entrée active (en cours) par utilisateur, tous tâches confondues —
-- c'est ce qui impose "une seule tâche active à la fois" côté DB, pas juste
-- côté UI/route API.
create unique index time_entries_one_active_per_user
  on public.time_entries(user_id) where (ended_at is null);

alter table public.time_entries enable row level security;

create policy "time_entries: own manage"
  on public.time_entries for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "time_entries: owner read"
  on public.time_entries for select to authenticated
  using (exists (
    select 1 from public.tasks t where t.id = time_entries.task_id and t.user_id = auth.uid()
  ));

create policy "time_entries: director read"
  on public.time_entries for select to authenticated
  using (
    public.my_org_role() = 'director'
    and exists (
      select 1 from public.tasks t
      where t.id = time_entries.task_id and t.user_id in (select public.my_org_owner_ids())
    )
  );

create policy "time_entries: chef read"
  on public.time_entries for select to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and exists (
      select 1 from public.tasks t
      where t.id = time_entries.task_id
      and t.user_id in (select public.my_org_owner_ids())
      and (
        t.assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
        or time_entries.user_id in (select user_id from public.team_memberships where team_id = public.my_team_id())
      )
    )
  );

-- ── 2. member_billing_config ─────────────────────────────────────────────────

create table public.member_billing_config (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete cascade not null,
  billing_mode  text not null default 'hourly' check (billing_mode in ('hourly', 'fixed')),
  hourly_rate   numeric(10,2),
  fixed_rate    numeric(10,2),
  currency      text not null default 'CAD',
  period        text not null default 'monthly' check (period in ('weekly', 'biweekly', 'monthly')),
  payment_info  text,
  updated_at    timestamptz default now()
);

drop trigger if exists member_billing_config_updated_at on public.member_billing_config;
create trigger member_billing_config_updated_at
  before update on public.member_billing_config
  for each row execute procedure public.handle_updated_at();

alter table public.member_billing_config enable row level security;

create policy "member_billing_config: own manage"
  on public.member_billing_config for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id = public.my_org_id());

create policy "member_billing_config: owner read"
  on public.member_billing_config for select to authenticated
  using (exists (
    select 1 from public.organizations o where o.id = member_billing_config.org_id and o.owner_id = auth.uid()
  ));

create policy "member_billing_config: director read"
  on public.member_billing_config for select to authenticated
  using (public.my_org_role() = 'director' and org_id = public.my_org_id());

-- ── 3. member_invoices ────────────────────────────────────────────────────────

create table public.member_invoices (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete cascade not null,
  member_id     uuid references auth.users(id) on delete cascade not null,
  period_start  date not null,
  period_end    date not null,
  items         jsonb not null default '[]'::jsonb,
  total         numeric(10,2) not null default 0,
  currency      text not null default 'CAD',
  billing_mode  text not null check (billing_mode in ('hourly', 'fixed')),
  rate          numeric(10,2),
  payment_info  text,
  status        text not null default 'brouillon' check (status in ('brouillon', 'envoyee', 'approuvee', 'payee')),
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  paid_at       timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint member_invoices_period_check check (period_end >= period_start)
);

create index member_invoices_org_id_idx    on public.member_invoices(org_id);
create index member_invoices_member_id_idx on public.member_invoices(member_id);

drop trigger if exists member_invoices_updated_at on public.member_invoices;
create trigger member_invoices_updated_at
  before update on public.member_invoices
  for each row execute procedure public.handle_updated_at();

alter table public.member_invoices enable row level security;

-- Défense en profondeur : un membre ne peut passer son statut que de
-- brouillon → envoyée, et ne peut plus rien modifier une fois envoyée.
-- Seul owner/director fait progresser vers approuvée/payée.
create or replace function public.member_invoices_enforce_update()
returns trigger
language plpgsql
as $$
declare
  is_owner_or_director boolean;
begin
  is_owner_or_director := (public.my_org_role() = 'director')
    or exists (select 1 from public.organizations o where o.id = old.org_id and o.owner_id = auth.uid());

  if not is_owner_or_director then
    if new.status not in ('brouillon', 'envoyee') then
      raise exception 'forbidden: seul owner/director peut approuver ou marquer payée une facture';
    end if;
    if old.status <> 'brouillon' and new.status is distinct from old.status then
      raise exception 'forbidden: seul owner/director peut changer le statut d''une facture déjà envoyée';
    end if;
    if old.status <> 'brouillon' and (
      new.items is distinct from old.items or new.total is distinct from old.total
    ) then
      raise exception 'forbidden: facture verrouillée une fois envoyée';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists member_invoices_enforce_update on public.member_invoices;
create trigger member_invoices_enforce_update
  before update on public.member_invoices
  for each row execute procedure public.member_invoices_enforce_update();

create policy "member_invoices: member select own"
  on public.member_invoices for select to authenticated
  using (member_id = auth.uid());

create policy "member_invoices: member insert own"
  on public.member_invoices for insert to authenticated
  with check (member_id = auth.uid() and org_id = public.my_org_id());

create policy "member_invoices: member update own"
  on public.member_invoices for update to authenticated
  using      (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy "member_invoices: member delete own draft"
  on public.member_invoices for delete to authenticated
  using (member_id = auth.uid() and status = 'brouillon');

create policy "member_invoices: owner read"
  on public.member_invoices for select to authenticated
  using (exists (
    select 1 from public.organizations o where o.id = member_invoices.org_id and o.owner_id = auth.uid()
  ));

create policy "member_invoices: owner write"
  on public.member_invoices for update to authenticated
  using (exists (
    select 1 from public.organizations o where o.id = member_invoices.org_id and o.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.organizations o where o.id = member_invoices.org_id and o.owner_id = auth.uid()
  ));

create policy "member_invoices: director read"
  on public.member_invoices for select to authenticated
  using (public.my_org_role() = 'director' and org_id = public.my_org_id());

create policy "member_invoices: director write"
  on public.member_invoices for update to authenticated
  using      (public.my_org_role() = 'director' and org_id = public.my_org_id())
  with check (public.my_org_role() = 'director' and org_id = public.my_org_id());

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('time_entries', 'member_billing_config', 'member_invoices')
order by tablename, policyname;
