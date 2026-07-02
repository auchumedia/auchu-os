-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 030 : Accès plateformes (identifiants clients) — table dédiée
-- ══════════════════════════════════════════════════════════════════════════════
-- Table séparée de "clients" par choix délibéré : la page portail fait
-- select('*') sur clients et sérialise l'objet entier dans le payload React
-- envoyé au navigateur du client (anon) — stocker des mots de passe comme
-- colonnes sur clients les aurait exposés dans le HTML du portail à la
-- moindre requête select('*') oubliée. Cette table n'a AUCUN grant anon et
-- n'est lue par aucun code du portail.
--
-- Accès restreint à owner + director (décision produit) — chef_equipe,
-- stratege, monteur n'ont ni lecture ni écriture ici, contrairement au reste
-- de la fiche client.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table public.client_platform_access (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references public.clients(id) on delete cascade not null unique,
  user_id             uuid references auth.users(id) on delete cascade not null,
  instagram_email     text,
  instagram_password  text,
  facebook_email      text,
  facebook_password   text,
  tiktok_email        text,
  tiktok_password     text,
  linkedin_email      text,
  linkedin_password   text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.client_platform_access enable row level security;

create trigger client_platform_access_updated_at
  before update on public.client_platform_access
  for each row execute procedure public.handle_updated_at();

create policy "platform_access: owner all"
  on public.client_platform_access for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "platform_access: director read"
  on public.client_platform_access for select to authenticated
  using (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "platform_access: director insert"
  on public.client_platform_access for insert to authenticated
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

create policy "platform_access: director update"
  on public.client_platform_access for update to authenticated
  using  (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()))
  with check (public.my_org_role() = 'director' and user_id in (select public.my_org_owner_ids()));

commit;

-- ── Vérification ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'client_platform_access'
order by policyname;
