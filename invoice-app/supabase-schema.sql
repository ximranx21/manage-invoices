-- =============================================
-- Invoice Manager — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create invoices table
create table public.invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_number text not null,
  client text not null,
  email text default '',
  date date not null,
  due_date date not null,
  status text check (status in ('unpaid', 'paid', 'delayed')) default 'unpaid',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create invoice_items table
create table public.invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0
);

-- 3. Create sequence for invoice numbers
create sequence public.invoice_number_seq start 1;

-- 4. Function to auto-generate invoice numbers
create or replace function public.generate_invoice_number()
returns trigger as $$
begin
  new.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

-- 5. Trigger to auto-set invoice number
create trigger set_invoice_number
  before insert on public.invoices
  for each row
  when (new.invoice_number is null or new.invoice_number = '')
  execute function public.generate_invoice_number();

-- 6. Function to auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.update_updated_at();

-- 7. Enable Row Level Security
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- 8. RLS Policies — users can only access their own data
create policy "Users can view own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert own invoices"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update own invoices"
  on public.invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete own invoices"
  on public.invoices for delete
  using (auth.uid() = user_id);

-- Invoice items policies (based on parent invoice ownership)
create policy "Users can view own invoice items"
  on public.invoice_items for select
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can insert own invoice items"
  on public.invoice_items for insert
  with check (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can update own invoice items"
  on public.invoice_items for update
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can delete own invoice items"
  on public.invoice_items for delete
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

-- 9. Indexes for performance
create index idx_invoices_user_id on public.invoices(user_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoice_items_invoice_id on public.invoice_items(invoice_id);


-- =============================================
-- Clients Module — Schema Extension
-- Run this AFTER the initial schema above
-- =============================================

-- 10. Create clients table
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text default '',
  phone text default '',
  company text default '',
  address text default '',
  notes text default '',
  credit_limit numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 11. Add client_id foreign key to invoices (nullable for backward compatibility)
alter table public.invoices
  add column client_id uuid references public.clients(id) on delete set null;

-- 12. Auto-update updated_at for clients
create trigger update_clients_updated_at
  before update on public.clients
  for each row
  execute function public.update_updated_at();

-- 13. Enable RLS on clients
alter table public.clients enable row level security;

-- 14. RLS Policies for clients
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

-- 15. Indexes for clients
create index idx_clients_user_id on public.clients(user_id);
create index idx_invoices_client_id on public.invoices(client_id);

-- =============================================
-- Credit Limit Migration (if clients table already exists)
-- Run this only if you already have the clients table
-- =============================================
-- alter table public.clients add column credit_limit numeric default 0;
