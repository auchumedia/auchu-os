-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 049 : Durcit l'accès à quickbooks_connections + synchro réelle
-- ══════════════════════════════════════════════════════════════════════════════
-- Part 1 — Sécurité : quickbooks_connections contient des jetons chiffrés.
-- Même chiffrés, on retire tout accès via authenticated (owner/director) :
-- seul le service_role (qui contourne TOUJOURS RLS chez Supabase) peut
-- encore lire/écrire cette table, depuis le serveur uniquement
-- (src/lib/supabase/admin.ts, jamais importé côté client). Les routes API
-- (connect/callback/disconnect/sync/status) vérifient le rôle elles-mêmes
-- avant d'appeler ce client admin — RLS n'est donc plus la seule barrière,
-- mais on la retire quand même ici pour ne pas donner une fausse impression
-- de sécurité "ceinture ET bretelles" qui masquerait un oubli de grant.
--
-- Part 2 — Index uniques partiels sur revenues/expenses pour que la synchro
-- QuickBooks (src/lib/quickbooks/sync.ts) puisse mettre à jour une ligne déjà
-- importée sans jamais en créer de doublon. external_id est NULL pour toute
-- entrée manuelle — le index étant partiel (WHERE external_id is not null),
-- les entrées manuelles n'y sont jamais soumises et ne sont donc jamais
-- touchées par la synchro (qui filtre explicitement source = 'quickbooks'
-- dans son code applicatif, en plus de cette contrainte).
--
-- Part 3 — Colonnes de suivi de synchro sur quickbooks_connections.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── Part 1 : retire l'accès authenticated à quickbooks_connections ─────────────

drop policy if exists "quickbooks_connections: owner all"            on public.quickbooks_connections;
drop policy if exists "quickbooks_connections: director read"        on public.quickbooks_connections;
drop policy if exists "quickbooks_connections: director insert"      on public.quickbooks_connections;
drop policy if exists "quickbooks_connections: director update"      on public.quickbooks_connections;
drop policy if exists "quickbooks_connections: director delete"      on public.quickbooks_connections;

-- RLS reste activée (déjà fait en migration 048) mais SANS AUCUNE policy
-- pour authenticated : select/insert/update/delete y sont donc tous refusés
-- pour ce rôle. Seul service_role (BYPASSRLS) traverse encore cette table.
alter table public.quickbooks_connections enable row level security;

-- Retire aussi les grants au niveau table — ceinture ET bretelles demandées
-- explicitement : même sans policy, on ne veut aucun grant résiduel.
revoke all on public.quickbooks_connections from authenticated;
revoke all on public.quickbooks_connections from anon;

-- ── Part 3 : suivi de synchro ───────────────────────────────────────────────────

alter table public.quickbooks_connections
  add column if not exists last_sync_at     timestamptz,
  add column if not exists last_sync_status text check (last_sync_status in ('success', 'error', 'reconnect_required'));

-- ── Part 2 : dédoublonnage des entrées importées ────────────────────────────────

create unique index if not exists revenues_user_source_external_uniq
  on public.revenues (user_id, source, external_id)
  where external_id is not null;

create unique index if not exists expenses_user_source_external_uniq
  on public.expenses (user_id, source, external_id)
  where external_id is not null;

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'quickbooks_connections';
-- → devrait ne retourner AUCUNE ligne.

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'quickbooks_connections';
-- → devrait ne retourner AUCUNE ligne pour anon/authenticated.
