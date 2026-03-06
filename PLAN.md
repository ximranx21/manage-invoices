# Invoice Manager — Implementation Plan

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL + Auth + REST API)
- **Auth**: Supabase Auth (email/password)

## Database Schema (Supabase)

### `invoices` table
| Column     | Type        | Notes                          |
|------------|-------------|--------------------------------|
| id         | uuid (PK)   | auto-generated                 |
| user_id    | uuid (FK)   | references auth.users          |
| invoice_number | text    | e.g. INV-001, auto-increment   |
| client     | text        | client/company name            |
| email      | text        | client email                   |
| date       | date        | issue date                     |
| due_date   | date        | payment due date               |
| status     | text        | 'unpaid' | 'paid' | 'delayed'  |
| notes      | text        | optional notes                 |
| created_at | timestamptz | auto-generated                 |
| updated_at | timestamptz | auto-generated                 |

### `invoice_items` table
| Column      | Type        | Notes                        |
|-------------|-------------|------------------------------|
| id          | uuid (PK)   | auto-generated               |
| invoice_id  | uuid (FK)   | references invoices.id       |
| description | text        | item description             |
| quantity    | numeric     | quantity                     |
| price       | numeric     | unit price                   |

### Row Level Security (RLS)
- Users can only read/write their own invoices
- Policies: `auth.uid() = user_id`

## Pages & Features

### 1. Auth Pages
- `/login` — Email/password login
- `/signup` — Registration
- Middleware to protect all routes except auth pages

### 2. Dashboard (`/dashboard`)
- Stats cards: Total, Unpaid, Paid, Delayed (count + amounts)
- Recent invoices table (last 5)
- Quick actions

### 3. Invoices List (`/invoices`)
- Searchable, filterable table (all / unpaid / paid / delayed)
- Sortable columns
- "New Invoice" button
- Click row → detail view

### 4. Invoice Detail (`/invoices/[id]`)
- Full invoice info + line items
- Status change buttons (Mark as Paid/Unpaid/Delayed)
- Edit / Delete actions

### 5. Create/Edit Invoice (`/invoices/new` and `/invoices/[id]/edit`)
- Form with client info, dates, status
- Dynamic line items (add/remove rows)
- Validation

## Implementation Steps

1. **Initialize Next.js project** with TypeScript, Tailwind, shadcn/ui
2. **Set up Supabase** client library and environment variables
3. **Create database schema** (SQL migration for tables + RLS policies)
4. **Build auth** — login/signup pages + middleware
5. **Build dashboard** page with stats
6. **Build invoices list** with search/filter/sort
7. **Build invoice detail** page
8. **Build create/edit** invoice form
9. **Add delete** functionality with confirmation
