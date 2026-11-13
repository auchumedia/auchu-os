-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 054 : Insight — statistiques sociales mensuelles (saisie manuelle)
-- ══════════════════════════════════════════════════════════════════════════════
-- Nouvel onglet "Insight" de la fiche contact : statistiques Instagram /
-- Facebook / TikTok saisies à la main, un enregistrement par (contact,
-- plateforme, mois). Aucune API externe, aucune collecte automatique.
--
-- Accès : owner, director et stratège peuvent VOIR ET MODIFIER (le stratège
-- seulement pour les contacts assignés à son équipe, via team_clients —
-- même pattern que "clients: team read" / "content: team read", migration
-- 045). monteur n'a NI lecture NI écriture : aucune policy ne le mentionne,
-- RLS refuse donc tout par défaut. Aucun grant anon — ces données sont
-- strictement internes, jamais exposées au portail client (même principe
-- que finance_revenues/finance_expenses, migration 047, et
-- client_platform_access, migration 030).
--
-- user_id = toujours l'id du propriétaire de l'org (= dataOwnerId côté
-- application), jamais l'id du membre qui saisit — même convention que
-- toutes les autres tables de données.
--
-- Tous les compteurs sont optionnels (null = pas saisi ce mois — on ne force
-- jamais une valeur à 0 par défaut, ce qui fausserait les variations et les
-- graphiques). "followers_gained" est signé (une page peut perdre des
-- abonnés un mois donné) ; tous les autres compteurs sont des volumes et
-- doivent rester ≥ 0 quand renseignés.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table public.client_insights (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  client_id         uuid references public.clients(id) on delete cascade not null,
  platform          text not null check (platform in ('instagram', 'facebook', 'tiktok')),
  month             date not null, -- toujours le 1er du mois

  followers         integer check (followers is null or followers >= 0),
  followers_gained  integer, -- signé : peut être négatif (perte nette d'abonnés)
  views             integer check (views is null or views >= 0),
  reach             integer check (reach is null or reach >= 0),
  likes             integer check (likes is null or likes >= 0),
  comments          integer check (comments is null or comments >= 0),
  shares            integer check (shares is null or shares >= 0),
  saves             integer check (saves is null or saves >= 0),
  profile_visits    integer check (profile_visits is null or profile_visits >= 0),
  posts_published   integer check (posts_published is null or posts_published >= 0),

  top_post_title    text,
  top_post_url      text,
  notes             text, -- interne uniquement, jamais inclus dans le PDF ni le portail

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint client_insights_unique_month unique (client_id, platform, month)
);

create index client_insights_user_month_idx on public.client_insights (user_id, month);
create index client_insights_client_idx     on public.client_insights (client_id);

alter table public.client_insights enable row level security;

drop trigger if exists client_insights_updated_at on public.client_insights;
create trigger client_insights_updated_at
  before update on public.client_insights
  for each row execute procedure public.handle_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

create policy "client_insights: owner all"
  on public.client_insights for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "client_insights: director all"
  on public.client_insights for all to authenticated
  using (
    public.my_org_role() = 'director'
    and user_id in (select public.my_org_owner_ids())
  )
  with check (
    public.my_org_role() = 'director'
    and user_id in (select public.my_org_owner_ids())
  );

create policy "client_insights: stratege team all"
  on public.client_insights for all to authenticated
  using (
    public.my_org_role() = 'stratege'
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  )
  with check (
    public.my_org_role() = 'stratege'
    and user_id in (select public.my_org_owner_ids())
    and client_id in (select client_id from public.team_clients where team_id = public.my_team_id())
  );

-- Aucune policy pour "monteur" (ni lecture, ni écriture — refus par défaut)
-- et aucun "grant ... to anon" — volontairement, cf. en-tête.

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'client_insights'
order by policyname;
