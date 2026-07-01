-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 025 : Création de clients restreinte à owner/director
-- ══════════════════════════════════════════════════════════════════════════════
-- Corrige 024_clients_director_chef_insert.sql : chef_equipe ne doit PAS
-- pouvoir créer de nouveaux clients (produit revu) — seulement voir/éditer
-- ceux déjà assignés à son équipe. Remplace la policy INSERT sur clients
-- pour retirer chef_equipe, et supprime la policy INSERT sur team_clients
-- qui n'existait que pour l'auto-assignation d'un client fraîchement créé
-- par un chef — devenue inutile puisque ce chemin de code n'existe plus.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "clients: director_chef insert" on public.clients;

create policy "clients: director insert"
  on public.clients for insert to authenticated
  with check (
    public.my_org_role() = 'director'
    and user_id in (select public.my_org_owner_ids())
  );

drop policy if exists "team_clients: chef insert own team" on public.team_clients;

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('clients', 'team_clients')
order by tablename, policyname;
