-- LocalAgent initial schema
-- Multi-tenant SaaS for Ontario local-service businesses

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  industry text,
  timezone text not null default 'America/Toronto',
  address text,
  city text,
  province text default 'ON',
  postal_code text,
  country text not null default 'CA',
  public_phone text,
  website text,
  service_area text,
  description text,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','unpaid','incomplete','paused','none')),
  onboarding_status text not null default 'started'
    check (onboarding_status in ('started','profile','hours','services','faqs','receptionist','calendar','phone','billing','test_call','active')),
  onboarding_step int not null default 0,
  suspended_at timestamptz,
  recording_enabled boolean not null default false,
  recording_disclosure text not null default 'This call may be recorded and transcribed to help us assist you.',
  transcript_retention_days int not null default 90,
  recording_retention_days int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner','member')),
  status text not null default 'active' check (status in ('invited','active','disabled')),
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_id_idx on public.organization_memberships (user_id);
create index organization_memberships_org_id_idx on public.organization_memberships (organization_id);

-- ---------------------------------------------------------------------------
-- Business configuration
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, day_of_week)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null default 60 check (duration_minutes > 0),
  base_price_cents int,
  requires_manual_confirmation boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_org_id_idx on public.services (organization_id);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  question text not null,
  answer text not null,
  category text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_org_id_idx on public.faqs (organization_id);

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default 'LocalAgent Receptionist',
  provider text not null default 'vapi',
  provider_assistant_id text,
  voice_provider text,
  voice_id text,
  greeting text,
  system_prompt text,
  fallback_message text default 'I am unable to help with that. A team member will follow up shortly.',
  transfer_phone text,
  transfer_enabled boolean not null default true,
  recording_enabled boolean not null default false,
  is_active boolean not null default true,
  is_primary boolean not null default true,
  tone text default 'warm_professional',
  configuration_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Only one active primary receptionist per organization
create unique index ai_agents_one_primary_active_per_org
  on public.ai_agents (organization_id)
  where is_active = true and is_primary = true;

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'twilio',
  provider_phone_number_id text,
  e164_number text not null,
  friendly_name text,
  status text not null default 'pending'
    check (status in ('pending','active','disabled','error')),
  ai_agent_id uuid references public.ai_agents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_phone_number_id)
);
create index phone_numbers_org_id_idx on public.phone_numbers (organization_id);

-- ---------------------------------------------------------------------------
-- Customers / calls / leads / appointments
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text,
  last_name text,
  phone_e164 text,
  email text,
  address text,
  city text,
  province text,
  postal_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_id_idx on public.customers (organization_id);
create unique index customers_org_phone_uq
  on public.customers (organization_id, phone_e164)
  where phone_e164 is not null;
create unique index customers_org_email_uq
  on public.customers (organization_id, lower(email))
  where email is not null;

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  ai_agent_id uuid references public.ai_agents (id) on delete set null,
  phone_number_id uuid references public.phone_numbers (id) on delete set null,
  provider text not null default 'vapi',
  provider_call_id text not null,
  direction text not null default 'inbound' check (direction in ('inbound','outbound')),
  caller_phone_e164 text,
  destination_phone_e164 text,
  status text not null default 'completed',
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  recording_url text,
  recording_storage_path text,
  transcript text,
  summary text,
  sentiment text,
  outcome text,
  transfer_status text,
  consent_recorded boolean,
  structured_result jsonb,
  estimated_provider_cost_cents int,
  raw_provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_call_id)
);
create index calls_org_id_idx on public.calls (organization_id);
create index calls_started_at_idx on public.calls (organization_id, started_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  call_id uuid references public.calls (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  source text not null default 'phone',
  status text not null default 'new'
    check (status in ('new','qualified','booked','follow_up','won','lost','spam')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  job_description text,
  requested_date date,
  requested_time_window text,
  estimated_value_cents int,
  assigned_user_id uuid references public.profiles (id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_org_id_idx on public.leads (organization_id);
create index leads_status_idx on public.leads (organization_id, status);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  external_calendar_provider text,
  external_calendar_event_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Toronto',
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed','no_show')),
  customer_notes text,
  internal_notes text,
  preferred_date date,
  preferred_time_window text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index appointments_external_event_uq
  on public.appointments (organization_id, external_calendar_provider, external_calendar_event_id)
  where external_calendar_event_id is not null;
create index appointments_org_starts_idx on public.appointments (organization_id, starts_at);

-- ---------------------------------------------------------------------------
-- Integrations / billing / usage / webhooks / notifications / audit
-- ---------------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected'
    check (status in ('disconnected','connected','error','pending')),
  external_account_id text,
  encrypted_credentials_reference text,
  configuration_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

-- Server-only credential vault (no anon/authenticated grants; service role only)
create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text not null default 'starter' check (plan in ('starter','growth','pro')),
  status text not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);
create unique index subscriptions_stripe_customer_uq
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;
create unique index subscriptions_stripe_subscription_uq
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  usage_type text not null,
  quantity numeric not null,
  unit text not null,
  cost_cents int,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index usage_records_org_idx on public.usage_records (organization_id, occurred_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  organization_id uuid references public.organizations (id) on delete set null,
  payload_hash text,
  processing_status text not null default 'received'
    check (processing_status in ('received','processing','processed','failed','ignored')),
  attempts int not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','member')),
  token_hash text not null,
  invited_by uuid references public.profiles (id),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','organizations','organization_memberships','business_hours','services','faqs',
    'ai_agents','phone_numbers','customers','calls','leads','appointments','integrations',
    'integration_secrets','subscriptions'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.business_hours enable row level security;
alter table public.services enable row level security;
alter table public.faqs enable row level security;
alter table public.ai_agents enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.customers enable row level security;
alter table public.calls enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.integrations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.webhook_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.team_invitations enable row level security;
-- integration_secrets: RLS on, no policies for authenticated/anon (service role only)
alter table public.integration_secrets enable row level security;

-- Profiles
create policy profiles_select_self on public.profiles for select using (
  id = auth.uid() or public.is_platform_admin()
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

-- Organizations
create policy orgs_select on public.organizations for select using (
  public.is_org_member(id) or public.is_platform_admin()
);
create policy orgs_insert on public.organizations for insert with check (auth.uid() is not null);
create policy orgs_update_owner on public.organizations for update using (
  public.is_org_owner(id) or public.is_platform_admin()
);

-- Memberships
create policy memberships_select on public.organization_memberships for select using (
  user_id = auth.uid() or public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy memberships_insert_owner on public.organization_memberships for insert with check (
  public.is_org_owner(organization_id) or user_id = auth.uid() or public.is_platform_admin()
);
create policy memberships_update_owner on public.organization_memberships for update using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
);

-- Generic tenant read/write macros via policies per table
create policy business_hours_all on public.business_hours for all using (
  public.is_org_member(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy services_select on public.services for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy services_write on public.services for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy faqs_select on public.faqs for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy faqs_write on public.faqs for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy ai_agents_select on public.ai_agents for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy ai_agents_write on public.ai_agents for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy phone_numbers_select on public.phone_numbers for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy phone_numbers_write on public.phone_numbers for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy customers_member on public.customers for all using (
  public.is_org_member(organization_id) or public.is_platform_admin()
) with check (public.is_org_member(organization_id) or public.is_platform_admin());

-- Calls: members can select without raw_provider_payload via view preferred;
-- base table select for members; service role used for inserts from webhooks.
create policy calls_select on public.calls for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy calls_member_update on public.calls for update using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);

create policy leads_member on public.leads for all using (
  public.is_org_member(organization_id) or public.is_platform_admin()
) with check (public.is_org_member(organization_id) or public.is_platform_admin());

create policy appointments_member on public.appointments for all using (
  public.is_org_member(organization_id) or public.is_platform_admin()
) with check (public.is_org_member(organization_id) or public.is_platform_admin());

create policy integrations_owner on public.integrations for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

create policy subscriptions_owner_select on public.subscriptions for select using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
);

create policy usage_select on public.usage_records for select using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);

create policy webhook_events_admin on public.webhook_events for select using (
  public.is_platform_admin()
);

create policy notifications_own on public.notifications for all using (
  user_id = auth.uid() or public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (
  user_id = auth.uid() or public.is_org_owner(organization_id) or public.is_platform_admin()
);

create policy audit_select on public.audit_logs for select using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
);

create policy invitations_owner on public.team_invitations for all using (
  public.is_org_owner(organization_id) or public.is_platform_admin()
) with check (public.is_org_owner(organization_id) or public.is_platform_admin());

-- View hiding raw payloads from members (owners/admins still use table via service or column grants)
create or replace view public.calls_safe as
select
  id, organization_id, customer_id, ai_agent_id, phone_number_id, provider, provider_call_id,
  direction, caller_phone_e164, destination_phone_e164, status, started_at, answered_at, ended_at,
  duration_seconds, recording_url, recording_storage_path, transcript, summary, sentiment, outcome,
  transfer_status, consent_recorded, structured_result, estimated_provider_cost_cents,
  created_at, updated_at
from public.calls;

grant select on public.calls_safe to authenticated;
