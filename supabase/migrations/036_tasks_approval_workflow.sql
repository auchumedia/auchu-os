-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 036 : Workflow d'approbation des tâches terminées
-- ══════════════════════════════════════════════════════════════════════════════
-- Ajoute le statut 'approuve'. Ce n'est PAS une nouvelle colonne de kanban —
-- une tâche 'approuve' reste affichée dans la colonne "Terminé" (bucketée
-- avec 'termine' côté UI), juste avec un badge différent. C'est un état
-- superposé à "terminé", pas une étape supplémentaire du board.
--
-- Flow :
--   a_faire → en_cours → termine   (la personne assignée marque "Terminé")
--   termine → approuve             (owner/director/chef_equipe approuve)
--
-- Permissions (complète migration 035, ne la remplace pas) :
--   - Approuver : owner/director (déjà en accès complet, rien à ajouter) ou
--     chef_equipe pour les tâches de son équipe, même sans en être le
--     créateur (nouvelle policy "tasks: chef approve" + trigger étendu pour
--     empêcher un simple assigné de s'auto-approuver).
--   - Une fois approuvée, la personne assignée peut aussi supprimer la
--     tâche (en plus du créateur et de owner/director, qui pouvaient déjà
--     supprimer peu importe le statut — inchangé).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Élargit le statut + colonnes d'audit d'approbation ───────────────────

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('a_faire', 'en_cours', 'termine', 'approuve'));

alter table public.tasks add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.tasks add column if not exists approved_at timestamptz;

-- ── 2. Trigger : étend tasks_enforce_role_update (035) — un simple assigné
--       (non créateur, non owner/director, non chef gérant l'équipe) peut
--       toujours changer le statut, mais ne peut PAS s'auto-approuver
--       (passer à 'approuve'). Seul un chef_equipe gérant l'équipe de la
--       personne assignée (ou déjà privilégié : owner/director/créateur)
--       peut approuver. ──────────────────────────────────────────────────────

create or replace function public.tasks_enforce_role_update()
returns trigger
language plpgsql
as $$
declare
  is_privileged    boolean;
  is_managing_chef boolean;
begin
  is_privileged := (auth.uid() = old.user_id)          -- owner
    or (public.my_org_role() = 'director')
    or (old.assigned_by = auth.uid());                  -- créateur de la tâche

  is_managing_chef := public.my_org_role() = 'chef_equipe'
    and old.assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id());

  if not is_privileged then
    if new.title       is distinct from old.title
       or new.description is distinct from old.description
       or new.assigned_to is distinct from old.assigned_to
       or new.assigned_by is distinct from old.assigned_by
       or new.client_id   is distinct from old.client_id
       or new.priority    is distinct from old.priority
       or new.deadline    is distinct from old.deadline
       or new.user_id     is distinct from old.user_id
    then
      raise exception 'forbidden: seul le créateur de la tâche ou un owner/director peut modifier autre chose que le statut';
    end if;

    if new.status = 'approuve' and old.status is distinct from 'approuve' and not is_managing_chef then
      raise exception 'forbidden: seul owner/director/chef d''équipe (ou le créateur) peut approuver une tâche';
    end if;
  end if;

  return new;
end;
$$;

-- ── 3. Policy : chef_equipe peut approuver (termine → approuve) une tâche
--       de son équipe même sans en être le créateur. Distincte de
--       "tasks: chef update" (édition complète, réservée au créateur) — le
--       trigger ci-dessus borne de toute façon cette policy au changement
--       de statut seul, peu importe la policy RLS qui a laissé passer
--       l'UPDATE. ───────────────────────────────────────────────────────────

drop policy if exists "tasks: chef approve" on public.tasks;

create policy "tasks: chef approve"
  on public.tasks for update to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and status = 'termine'
    and assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
  )
  with check (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and status = 'approuve'
  );

-- ── 4. Policy : la personne assignée peut supprimer sa tâche une fois
--       approuvée (créateur et owner/director pouvaient déjà supprimer peu
--       importe le statut — policies 035 inchangées, additives). ───────────

drop policy if exists "tasks: assigned delete when approved" on public.tasks;

create policy "tasks: assigned delete when approved"
  on public.tasks for delete to authenticated
  using (assigned_to = auth.uid() and status = 'approuve');

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;
