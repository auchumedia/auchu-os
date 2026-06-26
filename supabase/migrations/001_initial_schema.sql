-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Clients ──────────────────────────────────────────────────────────────────
create table public.clients (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  email        text,
  phone        text,
  company      text,
  industry     text,
  status       text not null default 'actif' check (status in ('actif','inactif','prospect')),
  monthly_budget numeric(10,2),
  brand_tone   text,
  brand_notes  text,
  platforms    text[] default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Projects ─────────────────────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','en_cours','review','termine','annule')),
  priority    text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  deadline    date,
  assigned_to uuid,
  tags        text[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Content pieces ───────────────────────────────────────────────────────────
create table public.content_pieces (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  client_id    uuid references public.clients(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null,
  type         text not null check (type in ('post','story','reel','ad','caption','script','email')),
  platform     text not null check (platform in ('instagram','facebook','tiktok','linkedin','google','meta')),
  status       text not null default 'draft' check (status in ('draft','review','approuve','publie','refuse')),
  body         text not null default '',
  variants     jsonb default '[]',
  scheduled_at timestamptz,
  published_at timestamptz,
  ai_generated boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Team members ─────────────────────────────────────────────────────────────
create table public.team_members (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  full_name   text not null,
  email       text not null,
  role        text not null default 'employee',
  avatar_url  text,
  status      text not null default 'actif' check (status in ('actif','inactif')),
  hourly_rate numeric(8,2),
  created_at  timestamptz default now()
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
create table public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  client_id      uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  status         text not null default 'draft' check (status in ('draft','envoye','paye','en_retard','annule')),
  items          jsonb not null default '[]',
  subtotal       numeric(10,2) not null default 0,
  tax_rate       numeric(5,2) not null default 0,
  tax_amount     numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  due_date       date,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.clients        enable row level security;
alter table public.projects       enable row level security;
alter table public.content_pieces enable row level security;
alter table public.team_members   enable row level security;
alter table public.invoices       enable row level security;

-- Policies: each user only sees their own data
create policy "users own clients"        on public.clients        for all using (auth.uid() = user_id);
create policy "users own projects"       on public.projects       for all using (auth.uid() = user_id);
create policy "users own content"        on public.content_pieces for all using (auth.uid() = user_id);
create policy "users own team_members"   on public.team_members   for all using (auth.uid() = user_id);
create policy "users own invoices"       on public.invoices       for all using (auth.uid() = user_id);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at        before update on public.clients        for each row execute procedure public.handle_updated_at();
create trigger projects_updated_at       before update on public.projects       for each row execute procedure public.handle_updated_at();
create trigger content_pieces_updated_at before update on public.content_pieces for each row execute procedure public.handle_updated_at();
create trigger invoices_updated_at       before update on public.invoices       for each row execute procedure public.handle_updated_at();
