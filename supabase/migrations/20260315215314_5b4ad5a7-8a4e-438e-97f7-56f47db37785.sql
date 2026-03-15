
-- Table: support_oncall_shifts
create table if not exists public.support_oncall_shifts (
  id uuid primary key default gen_random_uuid(),
  team_code text not null,
  team_name text not null,
  user_id integer null,
  user_name text not null,
  user_email text null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  notes text null,
  created_by integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_support_oncall_shifts_team_code
on public.support_oncall_shifts(team_code);

create index if not exists idx_support_oncall_shifts_active_window
on public.support_oncall_shifts(team_code, is_active, starts_at, ends_at);

-- Trigger updated_at
create trigger set_support_oncall_shifts_updated_at
  before update on public.support_oncall_shifts
  for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.support_oncall_shifts enable row level security;

-- RLS: internal team can read
create policy "oncall_shifts_select_internal"
  on public.support_oncall_shifts for select
  to authenticated
  using (is_support_internal());

-- RLS: admin/manager can manage
create policy "oncall_shifts_manage_admin"
  on public.support_oncall_shifts for all
  to authenticated
  using (is_support_admin_or_manager())
  with check (is_support_admin_or_manager());
