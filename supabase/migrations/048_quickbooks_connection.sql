-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 048 : Connexion QuickBooks Online (OAuth2) — owner + director
-- ══════════════════════════════════════════════════════════════════════════════
-- Une ligne par organisation (user_id = dataOwnerId, même convention que
-- revenues/expenses — migration 047). Les jetons sont chiffrés côté
-- application (AES-256-GCM, src/lib/quickbooks/crypto.ts) avant d'être
-- écrits ici : les colonnes *_token_encrypted contiennent iv + tag + texte
-- chiffré en base64, jamais le jeton en clair.
--
-- Accès restreint à owner + director (même pattern que client_platform_access
-- / revenues / expenses), via my_org_role()/my_org_owner_ids() (SECURITY
-- DEFINER, migrations 009/021 — pas de récursion RLS). AUCUN grant anon.
--
-- status :
--   'connected'          — jeton d'accès valide ou rafraîchissable
--   'reconnect_required' — refresh token expiré/révoqué (invalid_grant) :
--                          l'UI affiche "QuickBooks doit être reconnecté"
--   'disconnected'       — déconnecté volontairement (jeton révoqué chez
--                          Intuit), ligne conservée pour historique/audit
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table public.quickbooks_connections (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid references auth.users(id) on delete cascade not null unique,
  realm_id                    text not null,
  environment                 text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  access_token_encrypted      text,
  refresh_token_encrypted     text,
  access_token_expires_at     timestamptz,
  refresh_token_expires_at    timestamptz,
  status                      text not null default 'connected' check (status in ('connected', 'reconnect_required', 'disconnected')),
  company_name                text,
  last_error                  text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index quickbooks_connections_user_idx on public.quickbooks_connections (user_id);

alter table public.quickbooks_connections enable row level security;

drop trigger if exists quickbooks_connections_updated_at on public.quickbooks_connections;
create trigger quickbooks_connections_updated_at
  before update on public.quickbooks_connections
  for each row execute procedure public.handle_updated_at();

create policy "quickbooks_connections: owner all"
  on public.quickbooks_connections for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "quickbooks_connections: director read"
  on public.quickbooks_connections for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "quickbooks_connections: director insert"
  on public.quickbooks_connections for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "quickbooks_connections: director update"
  on public.quickbooks_connections for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "quickbooks_connections: director delete"
  on public.quickbooks_connections for delete to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

-- Aucun "grant ... to anon" ici, volontairement — cf. en-tête. Hérite du
-- privilège par défaut "authenticated" déjà en place sur le schéma public
-- (même mécanisme que client_platform_access / revenues / expenses).

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'quickbooks_connections'
order by policyname;
