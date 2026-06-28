-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 007 : Backfill organisations pour les utilisateurs existants
-- ══════════════════════════════════════════════════════════════════════════════
-- Pour chaque user_id présent dans clients/projects/content_pieces/invoices
-- qui n'a pas encore d'organisation, on crée automatiquement :
--   1. Une ligne dans public.organizations  (plan free, owner = user)
--   2. Une ligne dans public.org_members    (role = owner, status = actif)
-- Le nom de l'agence est lu depuis raw_user_meta_data->>'agency_name', puis
-- 'full_name', puis la partie locale de l'email, sinon 'Mon agence'.
-- ══════════════════════════════════════════════════════════════════════════════

do $$
declare
  r          record;
  new_org_id uuid;
  org_name   text;
begin
  for r in
    -- Tous les user_ids qui ont des données mais pas encore d'org
    select distinct uid as user_id
    from (
      select user_id as uid from public.clients
      union
      select user_id from public.projects
      union
      select user_id from public.content_pieces
      union
      select user_id from public.invoices
    ) all_uids
    where uid not in (
      select owner_id from public.organizations where owner_id is not null
    )
  loop
    -- Nom d'agence : agency_name → full_name → email local → fallback
    select coalesce(
      nullif(trim(raw_user_meta_data->>'agency_name'), ''),
      nullif(trim(raw_user_meta_data->>'full_name'),   ''),
      nullif(trim(split_part(email, '@', 1)),          ''),
      'Mon agence'
    ) into org_name
    from auth.users
    where id = r.user_id;

    -- Créer l'organisation
    insert into public.organizations (name, owner_id, plan, max_members)
    values (coalesce(org_name, 'Mon agence'), r.user_id, 'free', 1)
    returning id into new_org_id;

    -- Ajouter comme propriétaire dans org_members
    insert into public.org_members (org_id, user_id, role, status)
    values (new_org_id, r.user_id, 'owner', 'actif')
    on conflict (org_id, user_id) do nothing;

    raise notice 'Org créée pour user % : % (org_id: %)', r.user_id, org_name, new_org_id;
  end loop;
end;
$$;

-- ── Vérification ──────────────────────────────────────────────────────────────
select
  o.name          as org_name,
  o.owner_id,
  o.plan,
  u.email         as owner_email,
  m.role
from public.organizations o
join auth.users      u on u.id = o.owner_id
join public.org_members m on m.org_id = o.id and m.user_id = o.owner_id
order by o.created_at;
