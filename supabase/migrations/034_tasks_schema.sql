-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 034 : Système de tâches (assignation hiérarchique + RLS)
-- ══════════════════════════════════════════════════════════════════════════════
-- Suit la convention de toutes les tables de données existantes (clients,
-- projects, content_pieces, …) : "user_id" est l'ancre du tenant — l'ID du
-- owner de l'org (ctx.dataOwnerId), PAS un org_id littéral. Les tables
-- structurelles teams/team_memberships/team_clients (021) sont la seule
-- exception à ce pattern ; tasks est une table de données, donc elle suit
-- clients/projects/content_pieces, pas teams.
--
-- Permissions d'assignation (cf. src/lib/roles.ts::canCreateTasks) :
--   owner/director  → assigne à n'importe quel membre actif de l'org
--   chef_equipe     → assigne seulement aux membres de sa propre équipe
--   stratege/monteur → ne créent ni n'assignent — lecture + changement de
--                      statut sur leurs tâches assignées uniquement, imposé
--                      ici en plus par un trigger (défense en profondeur,
--                      pas seulement côté route API).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null not null,
  priority    text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  status      text not null default 'a_faire' check (status in ('a_faire','en_cours','termine')),
  deadline    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index tasks_user_id_idx     on public.tasks(user_id);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_client_id_idx   on public.tasks(client_id);
create index tasks_status_idx      on public.tasks(status);

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

alter table public.tasks enable row level security;

-- ── 2. Trigger : stratège/monteur ne peuvent modifier que le statut ──────────
-- Défense en profondeur — la route API filtre déjà les champs autorisés par
-- rôle, mais on ne s'y fie pas exclusivement (cf. commentaire migration 021
-- sur les RPC security definer). my_org_role() est déjà security definer
-- (021), donc pas besoin de re-décorer cette fonction.

create or replace function public.tasks_enforce_role_update()
returns trigger
language plpgsql
as $$
declare
  actor_role text := public.my_org_role();
begin
  if actor_role in ('stratege', 'monteur') then
    if new.title       is distinct from old.title
       or new.description is distinct from old.description
       or new.assigned_to is distinct from old.assigned_to
       or new.assigned_by is distinct from old.assigned_by
       or new.client_id   is distinct from old.client_id
       or new.priority    is distinct from old.priority
       or new.deadline    is distinct from old.deadline
       or new.user_id     is distinct from old.user_id
    then
      raise exception 'forbidden: % ne peut modifier que le statut d''une tâche', actor_role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_role_update on public.tasks;
create trigger tasks_enforce_role_update
  before update on public.tasks
  for each row execute procedure public.tasks_enforce_role_update();

-- ── 3. Policies RLS ──────────────────────────────────────────────────────────

-- owner : accès complet à ses propres données (l'owner EST l'ancre user_id)
create policy "tasks: owner all"
  on public.tasks for all to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- director : accès complet sur tout l'org (peut assigner à n'importe qui) —
-- séparé en 4 policies (pas "for all") car l'INSERT doit vérifier
-- assigned_by = auth.uid() (anti-usurpation), alors que l'UPDATE ne doit pas
-- l'exiger (sinon un director ne pourrait plus éditer une tâche créée par
-- quelqu'un d'autre, ex. un chef_equipe).
create policy "tasks: director read"
  on public.tasks for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "tasks: director insert"
  on public.tasks for insert to authenticated
  with check (
    public.my_org_role() = 'director'
    and user_id in (select public.my_org_owner_ids())
    and assigned_by = auth.uid()
  );

create policy "tasks: director update"
  on public.tasks for update to authenticated
  using      (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "tasks: director delete"
  on public.tasks for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- chef_equipe : lecture/écriture scopée à son équipe (team_memberships) —
-- lit aussi les tâches qu'il a lui-même créées ou qui lui sont assignées,
-- même hors équipe (ex. tâche assignée par un director).
create policy "tasks: chef read"
  on public.tasks for select to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and (
      assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
      or assigned_by = auth.uid()
      or assigned_to = auth.uid()
    )
  );

create policy "tasks: chef insert"
  on public.tasks for insert to authenticated
  with check (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and assigned_by = auth.uid()
    and assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
  );

create policy "tasks: chef update"
  on public.tasks for update to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and (
      assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
      or assigned_by = auth.uid()
    )
  )
  with check (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
  );

create policy "tasks: chef delete"
  on public.tasks for delete to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and assigned_by = auth.uid()
  );

-- Tout rôle (y compris stratege/monteur) : voit et change le statut de ses
-- propres tâches assignées. L'UPDATE ne touche QUE le statut pour
-- stratege/monteur — imposé par le trigger ci-dessus, pas par cette policy.
create policy "tasks: assigned read"
  on public.tasks for select to authenticated
  using (assigned_to = auth.uid());

create policy "tasks: assigned status update"
  on public.tasks for update to authenticated
  using      (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;
