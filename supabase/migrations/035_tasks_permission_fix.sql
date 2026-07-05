-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 035 : Corrige les permissions d'édition/suppression des tâches
-- ══════════════════════════════════════════════════════════════════════════════
-- La migration 034 laissait un chef_equipe modifier N'IMPORTE QUEL champ
-- d'une tâche assignée à un membre de son équipe, même s'il n'en était pas
-- le créateur (policy "tasks: chef update", clause "assigned_to in team").
-- Le trigger de restriction de champs ne visait en plus que les rôles
-- stratege/monteur — un chef simple assigné (pas créateur) passait donc au
-- travers, alors qu'il ne devrait pouvoir que changer le statut.
--
-- Règles corrigées :
--   - Modifier (titre/description/priorité/deadline/assigné à) : seulement
--     assigned_by (le créateur) OU owner/director.
--   - Supprimer : seulement assigned_by OU owner/director (déjà correct pour
--     chef_equipe — "tasks: chef delete" exigeait déjà assigned_by = auth.uid(),
--     inchangée ici).
--   - Changer le statut : assigned_to, assigned_by, OU owner/director.
--
-- Le trigger passe donc d'une liste de rôles en dur à une vérification par
-- relation (créateur / owner / director), ce qui couvre aussi le cas
-- chef_equipe simple assigné — pas seulement stratege/monteur.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Trigger : seul le créateur ou owner/director peut modifier autre
--       chose que le statut. my_org_role() renvoie NULL pour un owner (pas
--       de ligne org_members) — on détecte donc l'owner via
--       auth.uid() = user_id (l'ancre du tenant), comme "tasks: owner all". ──

create or replace function public.tasks_enforce_role_update()
returns trigger
language plpgsql
as $$
declare
  is_privileged boolean;
begin
  is_privileged := (auth.uid() = old.user_id)          -- owner
    or (public.my_org_role() = 'director')
    or (old.assigned_by = auth.uid());                  -- créateur de la tâche

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
  end if;

  return new;
end;
$$;

-- ── 2. Policy "tasks: chef update" — retire la clause "assigned_to in team",
--       qui permettait de modifier n'importe quel champ d'une tâche de
--       l'équipe sans en être le créateur. Un chef simple assigné passe
--       maintenant par "tasks: assigned status update" (statut seulement,
--       imposé par le trigger ci-dessus). ────────────────────────────────────

drop policy if exists "tasks: chef update" on public.tasks;

create policy "tasks: chef update"
  on public.tasks for update to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and assigned_by = auth.uid()
  )
  with check (
    public.my_org_role() = 'chef_equipe'
    and user_id in (select public.my_org_owner_ids())
    and assigned_to in (select user_id from public.team_memberships where team_id = public.my_team_id())
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;
