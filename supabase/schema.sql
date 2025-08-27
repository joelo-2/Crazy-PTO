-- Minimal schema for static PTO days + approvals + blackout dates
create type user_role as enum ('admin','manager','employee');
create type req_status as enum ('PENDING','APPROVED','DENIED','CANCELLED');
create type location as enum ('CompanyA','CompanyB','CompanyC');

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role default 'employee' not null,
  full_name text,
  email text unique,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, full_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (user_id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete set null,
  full_name text not null,
  email text not null unique,
  home_location location not null default 'CompanyA',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists pto_banks (
  employee_id uuid primary key references employees(id) on delete cascade,
  days_remaining integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists blackout_dates (
  id uuid primary key default gen_random_uuid(),
  loc location not null,
  start_date date not null,
  end_date date not null,
  reason text
);

create table if not exists time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  loc location not null,
  start_date date not null,
  end_date date not null,
  days_requested integer not null check (days_requested > 0),
  status req_status not null default 'PENDING',
  note text,
  decided_by uuid references profiles(user_id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists time_off_idx on time_off_requests (loc, start_date, end_date, status);

create or replace function has_blackout(loc location, s date, e date)
returns boolean language sql as $$
  select exists(
    select 1 from blackout_dates b
    where b.loc = has_blackout.loc
      and daterange(b.start_date, b.end_date + 1, '[)') && daterange(s, e + 1, '[)')
  );
$$;

create or replace function approve_request(p_request_id uuid, p_decider uuid)
returns void as $$
declare v_emp uuid; v_days int; v_bank int; v_loc location; v_s date; v_e date; begin
  select employee_id, days_requested, loc, start_date, end_date
  into v_emp, v_days, v_loc, v_s, v_e
  from time_off_requests where id = p_request_id for update;

  if has_blackout(v_loc, v_s, v_e) then
    raise exception 'Request overlaps blackout dates';
  end if;

  select days_remaining into v_bank from pto_banks where employee_id = v_emp for update;
  if v_bank is null then raise exception 'No PTO bank for employee'; end if;
  if v_bank < v_days then raise exception 'Insufficient PTO balance'; end if;

  update time_off_requests set status='APPROVED', decided_by=p_decider, decided_at=now() where id=p_request_id;
  update pto_banks set days_remaining = v_bank - v_days, updated_at = now() where employee_id = v_emp;
end; $$ language plpgsql security definer;

alter table profiles enable row level security;
alter table employees enable row level security;
alter table pto_banks enable row level security;
alter table time_off_requests enable row level security;
alter table blackout_dates enable row level security;

create policy "read own or admin" on profiles for select using (
  user_id = auth.uid() or exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager'))
);
create policy "admin manage" on profiles for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role='admin'));

create policy "employees readable" on employees for select using (true);
create policy "admin write employees" on employees for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager')));

create policy "banks readable" on pto_banks for select using (true);
create policy "admin write banks" on pto_banks for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager')));

create policy "requests owner or admin" on time_off_requests for select using (
  exists(select 1 from employees e where e.id = time_off_requests.employee_id and (e.user_id = auth.uid()))
  or exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager'))
);
create policy "create own request" on time_off_requests for insert with check (
  exists(select 1 from employees e where e.id = time_off_requests.employee_id and (e.user_id = auth.uid()))
);
create policy "admin update requests" on time_off_requests for update using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager')));

create policy "blackouts readable" on blackout_dates for select using (true);
create policy "admin write blackouts" on blackout_dates for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('admin','manager')));
