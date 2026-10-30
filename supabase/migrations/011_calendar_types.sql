-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 011 : Étendre calendar_events + vue équipe
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Ajouter les types 'reunion' et 'deadline'
do $$
begin
  alter table public.calendar_events
    drop constraint if exists calendar_events_type_check;
exception when others then null;
end $$;

alter table public.calendar_events
  add constraint calendar_events_type_check
  check (type in ('tournage', 'publication', 'reunion', 'deadline'));

-- 2. Rendre client_id optionnel (événements standalone)
alter table public.calendar_events
  alter column client_id drop not null;

-- 3. Fonction SECURITY DEFINER : user_ids des membres de l'org de l'owner courant
create or replace function public.my_org_member_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select om.user_id
  from public.org_members om
  join public.organizations o on o.id = om.org_id
  where o.owner_id = auth.uid() and om.status = 'actif'
$$;

-- 4. Policy : owner voit les événements de tous ses membres
drop policy if exists "calendar: org owner sees team" on public.calendar_events;

create policy "calendar: org owner sees team"
  on public.calendar_events for select
  to authenticated
  using (user_id in (select public.my_org_member_ids()));
