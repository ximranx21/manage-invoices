-- =============================================
-- Quotes (Devis) Migration
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create quotes table
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  quote_number text not null default '',
  client text not null default '',
  email text default '',
  client_id uuid references public.clients(id) on delete set null,
  date date not null,
  expiry_date date not null,
  status text check (status in ('draft', 'sent', 'accepted', 'declined')) default 'draft',
  notes text default '',
  currency text not null default 'MAD',
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create quote_items table
create table public.quote_items (
  id uuid default gen_random_uuid() primary key,
  quote_id uuid references public.quotes(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete set null,
  description text not null default '',
  quantity numeric not null default 1,
  price numeric not null default 0,
  tax_rate numeric not null default 0
);

-- 3. Sequence for quote numbers
create sequence public.quote_number_seq start 1;

-- 4. Function to auto-generate quote numbers (DEV-XXXX)
create or replace function public.generate_quote_number()
returns trigger as $$
begin
  new.quote_number := 'DEV-' || lpad(nextval('public.quote_number_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

-- 5. Trigger to auto-set quote number on insert
create trigger set_quote_number
  before insert on public.quotes
  for each row
  when (new.quote_number is null or new.quote_number = '')
  execute function public.generate_quote_number();

-- 6. Trigger to auto-update updated_at
create trigger update_quotes_updated_at
  before update on public.quotes
  for each row
  execute function public.update_updated_at();

-- 7. Enable Row Level Security
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

-- 8. RLS Policies
create policy "Users can manage their own quotes"
  on public.quotes for all
  using (auth.uid() = user_id);

create policy "Users can manage their own quote items"
  on public.quote_items for all
  using (
    exists (
      select 1 from public.quotes
      where quotes.id = quote_items.quote_id
        and quotes.user_id = auth.uid()
    )
  );
