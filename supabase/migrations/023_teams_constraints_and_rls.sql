-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 023 : Contraintes + RLS pour les nouveaux rôles (étape cassante)
-- ══════════════════════════════════════════════════════════════════════════════
-- À exécuter IMMÉDIATEMENT APRÈS le déploiement du nouveau code Next.js, pas
-- avant : les anciennes hypothèses RLS ("tout membre actif lit tous les
-- clients") deviennent fausses ici, et les CHECK constraints se resserrent.
-- Prérequis : 021 et 022 déjà appliquées.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Contraintes CHECK sur les rôles ──────────────────────────────────────────

alter table public.org_members drop constraint if exists org_members_role_check;
alter table public.org_members add constraint org_members_role_check
  check (role in ('owner', 'director', 'chef_equipe', 'stratege', 'monteur'));

alter table public.invitations drop constraint if exists invitations_role_check;
alter table public.invitations add constraint invitations_role_check
  check (role in ('director', 'chef_equipe', 'stratege', 'monteur'));

-- ── 2. org_members : garder "owner manages" (for all, inchangée), ajouter des
--       policies UPDATE hiérarchiques additives (les policies permissives
--       s'additionnent en OR sous RLS Postgres). DELETE reste exclusivement
--       couvert par "owner manages" — personne d'autre n'a de policy DELETE. ──

drop policy if exists "org_members: director updates managed roles" on public.org_members;
create policy "org_members: director updates managed roles"
  on public.org_members for update to authenticated
  using (
    public.my_org_role() = 'director'
    and org_id = public.my_org_id()
    and role in ('chef_equipe', 'stratege', 'monteur')
  )
  with check (
    public.my_org_role() = 'director'
    and org_id = public.my_org_id()
    and role in ('chef_equipe', 'stratege', 'monteur')
  );

drop policy if exists "org_members: chef updates team roles" on public.org_members;
create policy "org_members: chef updates team roles"
  on public.org_members for update to authenticated
  using (
    public.my_org_role() = 'chef_equipe'
    and role in ('stratege', 'monteur')
    and user_id in (select user_id from public.team_memberships where team_id = public.my_team_id())
  )
  with check (
    public.my_org_role() = 'chef_equipe'
    and role in ('stratege', 'monteur')
  );

-- ── 3. invitations : garder "owner manages" (for all, inchangée) ; ajouter
--       INSERT + DELETE hiérarchiques pour director/chef_equipe. SELECT reste
--       couvert par les policies publiques existantes (009/015, inchangées —
--       filtrage par org/équipe fait côté application, comme aujourd'hui). ──

drop policy if exists "invitations: hierarchy insert" on public.invitations;
create policy "invitations: hierarchy insert"
  on public.invitations for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.can_manage_role(public.my_org_role(), role)
    and (public.my_org_role() <> 'chef_equipe' or team_id = public.my_team_id())
  );

drop policy if exists "invitations: hierarchy delete" on public.invitations;
create policy "invitations: hierarchy delete"
  on public.invitations for delete to authenticated
  using (
    (public.my_org_role() = 'director' and org_id = public.my_org_id())
    or (public.my_org_role() = 'chef_equipe' and team_id = public.my_team_id())
  );

-- ── 4. clients : remplacer le modèle "tout membre actif lit tout" +
--       assigned_partner (012_partner_role.sql) par un modèle équipe. ─────────

drop policy if exists "clients: member read"          on public.clients;
drop policy if exists "clients: partner read assigned" on public.clients;
-- "clients: owner all" (auth.uid() = user_id) inchangée.

create policy "clients: director read"
  on public.clients for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "clients: team read"
  on public.clients for select to authenticated
  using (
    public.my_org_role() in ('chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

-- ── 5. projects : même modèle, + lecture des projets personnellement assignés
--       (garde-fou pour Mon espace, indépendant de l'assignation d'équipe). ───

drop policy if exists "projects: member read" on public.projects;
-- "projects: owner all" inchangée.

create policy "projects: director read"
  on public.projects for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "projects: team read"
  on public.projects for select to authenticated
  using (
    public.my_org_role() in ('chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

drop policy if exists "projects: assigned read" on public.projects;
create policy "projects: assigned read"
  on public.projects for select to authenticated
  using (assigned_to = auth.uid());

-- ── 6. content_pieces : même modèle. "content: owner all" et
--       "content: editor update assigned" (assigned_user_id = auth.uid(), ne
--       référence aucun rôle en dur) restent inchangées. ──────────────────────

drop policy if exists "content: member read" on public.content_pieces;

create policy "content: director read"
  on public.content_pieces for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "content: team read"
  on public.content_pieces for select to authenticated
  using (
    public.my_org_role() in ('chef_equipe', 'stratege', 'monteur')
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

drop policy if exists "content: assigned read" on public.content_pieces;
create policy "content: assigned read"
  on public.content_pieces for select to authenticated
  using (assigned_user_id = auth.uid());

-- ── 7. invoices / expenses : owner uniquement désormais (resserré). La
--       fonction my_managed_org_owner_ids() est laissée définie mais
--       inutilisée — nettoyage différé dans une migration ultérieure à froid. ─

drop policy if exists "invoices: manager read"  on public.invoices;
drop policy if exists "expenses: manager read"  on public.expenses;
-- "invoices: owner all" / "expenses: owner all" inchangées — seules policies restantes.

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('org_members', 'invitations', 'clients', 'projects', 'content_pieces', 'invoices', 'expenses')
order by tablename, policyname;
