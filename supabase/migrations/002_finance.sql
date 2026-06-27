-- ─── TPS/TVQ columns on invoices ─────────────────────────────────────────────
alter table public.invoices
  add column if not exists tps_amount numeric(10,2) not null default 0,
  add column if not exists tvq_amount numeric(10,2) not null default 0;

-- ─── Expenses table ───────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null,
  amount      numeric(10,2) not null,
  category    text not null default 'autre' check (category in (
    'logiciels','publicite','equipement','deplacements',
    'formation','services','loyer','telephone','autre'
  )),
  date        date not null default current_date,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "users own expenses"
  on public.expenses for all
  using (auth.uid() = user_id);
