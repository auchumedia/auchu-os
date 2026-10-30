-- 044 : AuchuOS interne (pas de plans, pas de chef_equipe, bloc-notes, short/long form)

alter table org_members drop constraint if exists org_members_role_check;
alter table invitations drop constraint if exists invitations_role_check;
update org_members set role = 'director' where role = 'chef_equipe';
update invitations set role = 'director' where role = 'chef_equipe';
alter table org_members add constraint org_members_role_check
  check (role in ('owner','director','stratege','monteur'));
alter table invitations add constraint invitations_role_check
  check (role in ('director','stratege','monteur'));

alter table content_pieces drop constraint if exists content_pieces_status_check;
update content_pieces set status = 'idee' where status = 'en_redaction';
alter table content_pieces add constraint content_pieces_status_check
  check (status in ('idee','pret','approuve','refuse','filme','publie'));

alter table content_pieces add column if not exists internal_notes text;
update content_pieces set internal_notes = description
  where internal_notes is null and description is not null;

alter table content_pieces drop constraint if exists content_pieces_type_check;
update content_pieces set type = 'short_form' where type is distinct from 'long_form';
alter table content_pieces add constraint content_pieces_type_check
  check (type in ('short_form','long_form'));

alter table clients add column if not exists deliverables_short_form int not null default 0;
alter table clients add column if not exists deliverables_long_form int not null default 0;
update clients set deliverables_short_form =
  coalesce(deliverables_video_organique,0)+coalesce(deliverables_story,0)+coalesce(deliverables_ad,0)
  where deliverables_short_form = 0;
