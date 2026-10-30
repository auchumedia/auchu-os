-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 024 : director/chef_equipe peuvent créer des clients
-- ══════════════════════════════════════════════════════════════════════════════
-- "clients: owner all" (auth.uid() = user_id) est la seule policy
-- d'écriture — un director/chef_equipe qui crée un client insère une ligne
-- avec user_id = ctx.dataOwnerId (le owner du workspace), pas leur propre
-- auth.uid(), donc ce insert échoue sans une policy dédiée.
-- stratege/monteur ne reçoivent aucune policy d'écriture ici — ils restent
-- en lecture seule sur les clients, conformément au produit.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "clients: director_chef insert" on public.clients;

create policy "clients: director_chef insert"
  on public.clients for insert to authenticated
  with check (
    public.my_org_role() in ('director', 'chef_equipe')
    and user_id in (select public.my_org_owner_ids())
  );

-- Un chef_equipe qui crée un client se l'auto-assigne à sa propre équipe
-- (sinon "clients: team read" le rendrait invisible pour lui-même juste
-- après l'avoir créé) — "team_clients: owner_director write" ne couvrait
-- que owner/director, pas chef_equipe sur sa propre équipe.
drop policy if exists "team_clients: chef insert own team" on public.team_clients;

create policy "team_clients: chef insert own team"
  on public.team_clients for insert to authenticated
  with check (
    public.my_org_role() = 'chef_equipe'
    and team_id = public.my_team_id()
  );

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'clients'
order by policyname;
