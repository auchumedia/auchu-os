-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 037 : Corrige les règles d'approbation des tâches
-- ══════════════════════════════════════════════════════════════════════════════
-- La migration 036 laissait un chef_equipe approuver N'IMPORTE QUELLE tâche
-- de son équipe ("tasks: chef approve", scopée par team_memberships), même
-- s'il n'en était pas le créateur. Elle permettait aussi l'auto-approbation :
-- le créateur (assigned_by = auth.uid()) était toujours "privilégié" dans le
-- trigger, y compris pour une tâche qu'il s'était assignée à lui-même.
--
-- Règles corrigées :
--   - Owner / director : approuvent toujours, n'importe quelle tâche.
--   - chef_equipe : approuve UNIQUEMENT les tâches dont il est le créateur
--     (assigned_by = son user_id) — plus de portée "toute l'équipe".
--   - Personne ne peut s'auto-approuver : assigned_by = auth.uid() ET
--     assigned_to = auth.uid() → interdit, MÊME pour owner/director (règle
--     de séparation des tâches : on n'approuve jamais son propre travail).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Retire la policy d'approbation par équipe (036) — remplacée par la
--       portée "créateur uniquement" ci-dessous. "tasks: chef update" (035,
--       scopée assigned_by = auth.uid()) reste la policy qui donne accès en
--       écriture à un chef sur ses propres tâches créées ; elle suffit
--       maintenant à couvrir l'approbation, le trigger décidant du reste. ───

drop policy if exists "tasks: chef approve" on public.tasks;

-- ── 2. Trigger : approbation réservée à owner/director ou au créateur —
--       jamais en auto-approbation, même pour owner/director. ─────────────

create or replace function public.tasks_enforce_role_update()
returns trigger
language plpgsql
as $$
declare
  is_owner_or_director boolean;
  is_creator           boolean;
  is_self_assigned      boolean;
  approving             boolean;
begin
  is_owner_or_director := (auth.uid() = old.user_id)          -- owner
    or (public.my_org_role() = 'director');
  is_creator           := old.assigned_by = auth.uid();       -- créateur de la tâche
  is_self_assigned     := old.assigned_by = auth.uid() and old.assigned_to = auth.uid();
  approving            := new.status = 'approuve' and old.status is distinct from 'approuve';

  -- Édition complète (tout champ autre que le statut) : réservée au
  -- créateur ou à owner/director — inchangé depuis 035.
  if not (is_owner_or_director or is_creator) then
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

  -- Approuver (passage à 'approuve') :
  --   - jamais en auto-approbation (créateur ET assigné = soi-même), quel
  --     que soit le rôle, owner/director inclus ;
  --   - sinon réservé à owner/director (toute tâche) ou au créateur de la
  --     tâche (un chef_equipe ne peut donc approuver que ce qu'il a
  --     lui-même créé — plus de portée "toute l'équipe", cf. 036 retirée).
  if approving then
    if is_self_assigned then
      raise exception 'forbidden: personne ne peut s''auto-approuver une tâche';
    elsif not (is_owner_or_director or is_creator) then
      raise exception 'forbidden: seul owner/director, ou le créateur de la tâche, peut l''approuver';
    end if;
  end if;

  return new;
end;
$$;

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;
