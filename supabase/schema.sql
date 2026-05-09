-- Luxon Ops App database starter schema
-- Run this inside the Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id),
  full_name text not null,
  role text not null check (role in ('admin', 'contractor')),
  phone text,
  created_at timestamptz default now()
);

create table if not exists contractors (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id),
  full_name text not null,
  email text,
  phone text,
  default_position text,
  default_rate numeric(10,2) default 0,
  rate_type text not null default 'day' check (rate_type in ('hour', 'day')),
  w9_on_file boolean default false,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id),
  event_name text not null,
  client_name text,
  venue text,
  address text,
  start_date date,
  end_date date,
  status text default 'scheduled',
  notes text,
  created_at timestamptz default now()
);

create table if not exists assignments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id),
  event_id uuid references events(id) on delete cascade,
  contractor_id uuid references contractors(id),
  position text,
  work_date date not null,
  call_time time,
  scheduled_end_time time,
  break_hours numeric(5,2) default 0,
  rate numeric(10,2) default 0,
  rate_type text not null default 'day' check (rate_type in ('hour', 'day')),
  confirmed boolean default false,
  approved boolean default false,
  created_at timestamptz default now()
);

create table if not exists time_entries (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id),
  assignment_id uuid references assignments(id) on delete cascade,
  contractor_id uuid references contractors(id),
  clock_in timestamptz,
  clock_out timestamptz,
  clock_in_lat numeric,
  clock_in_lng numeric,
  clock_out_lat numeric,
  clock_out_lng numeric,
  contractor_notes text,
  admin_notes text,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id),
  event_id uuid references events(id),
  invoice_number text,
  client_name text,
  subtotal numeric(10,2) default 0,
  status text default 'draft',
  terms text default 'Net 30',
  created_at timestamptz default now()
);

create table if not exists invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  assignment_id uuid references assignments(id),
  description text,
  hours numeric(10,2),
  rate numeric(10,2),
  amount numeric(10,2),
  created_at timestamptz default now()
);

-- Basic RLS enablement. Add tighter policies before production.
alter table companies enable row level security;
alter table profiles enable row level security;
alter table contractors enable row level security;
alter table events enable row level security;
alter table assignments enable row level security;
alter table time_entries enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
