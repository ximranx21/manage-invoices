-- =============================================
-- Articles + Payments + Modifications Migration
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. NEW TABLE: articles
create table public.articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  type text check (type in ('product', 'service')) not null,
  sku text not null default '',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0,
  stock_quantity numeric default null,
  min_stock_alert numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Sequences for SKU auto-generation
create sequence public.product_sku_seq start 1;
create sequence public.service_sku_seq start 1;

-- 3. Function to auto-generate SKU
create or replace function public.generate_article_sku()
returns trigger as $$
begin
  if new.type = 'product' then
    new.sku := 'PRD-' || lpad(nextval('public.product_sku_seq')::text, 4, '0');
  else
    new.sku := 'SRV-' || lpad(nextval('public.service_sku_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

-- 4. Trigger for SKU auto-generation
create trigger set_article_sku
  before insert on public.articles
  for each row
  when (new.sku is null or new.sku = '')
  execute function public.generate_article_sku();

-- 5. updated_at trigger for articles (reuses existing function)
create trigger update_articles_updated_at
  before update on public.articles
  for each row
  execute function public.update_updated_at();

-- 6. RLS on articles
alter table public.articles enable row level security;

create policy "Users can view own articles"
  on public.articles for select
  using (auth.uid() = user_id);

create policy "Users can insert own articles"
  on public.articles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own articles"
  on public.articles for update
  using (auth.uid() = user_id);

create policy "Users can delete own articles"
  on public.articles for delete
  using (auth.uid() = user_id);

-- 7. Indexes for articles
create index idx_articles_user_id on public.articles(user_id);
create index idx_articles_type on public.articles(type);
create index idx_articles_is_active on public.articles(is_active);

-- 8. ALTER invoice_items: add article_id and tax_rate
alter table public.invoice_items
  add column article_id uuid references public.articles(id) on delete set null,
  add column tax_rate numeric not null default 0;

create index idx_invoice_items_article_id on public.invoice_items(article_id);

-- 9. ALTER invoices: add currency
alter table public.invoices
  add column currency text not null default 'MAD';

-- 10. Update status constraint to include 'partially_paid'
-- First drop the old constraint (name may vary, check with:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND contype = 'c';)
alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
    check (status in ('unpaid', 'paid', 'delayed', 'partially_paid'));

-- 11. NEW TABLE: payments
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  amount numeric not null,
  payment_date date not null,
  payment_type text check (payment_type in ('cash', 'bank_transfer', 'check')) not null,
  reference text default '',
  notes text default '',
  created_at timestamptz default now()
);

-- 12. RLS on payments
alter table public.payments enable row level security;

create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id);

create policy "Users can delete own payments"
  on public.payments for delete
  using (auth.uid() = user_id);

-- 13. Indexes for payments
create index idx_payments_user_id on public.payments(user_id);
create index idx_payments_invoice_id on public.payments(invoice_id);
