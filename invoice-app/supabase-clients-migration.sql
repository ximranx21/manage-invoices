-- =============================================
-- Clients Module — Migration
-- Run this in Supabase SQL Editor if you already
-- ran the initial schema and need to add clients
-- =============================================

-- 1. Create clients table
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text default '',
  phone text default '',
  company text default '',
  address text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Add client_id foreign key to invoices (nullable for backward compatibility)
alter table public.invoices
  add column client_id uuid references public.clients(id) on delete set null;

-- 3. Auto-update updated_at for clients (reuses existing function)
create trigger update_clients_updated_at
  before update on public.clients
  for each row
  execute function public.update_updated_at();

-- 4. Enable RLS on clients
alter table public.clients enable row level security;

-- 5. RLS Policies for clients
create policy "Users can view own clients"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "Users can insert own clients"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clients"
  on public.clients for update
  using (auth.uid() = user_id);

create policy "Users can delete own clients"
  on public.clients for delete
  using (auth.uid() = user_id);

-- 6. Indexes
create index idx_clients_user_id on public.clients(user_id);
create index idx_invoices_client_id on public.invoices(client_id);
