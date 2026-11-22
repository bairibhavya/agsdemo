-- AGS Self Drive Wheels: proposed Supabase schema (not connected to frontend yet)
-- Run in Supabase SQL Editor after reviewing ownership, security and client policies.
create extension if not exists btree_gist;
create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.vehicle_models (
 id text primary key, name text not null, category text not null check(category in ('Scooter','Motorcycle')),
 same_day_price integer not null check(same_day_price>=0), day_price integer not null check(day_price>=0),
 photo_url text, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.vehicle_units (
 id uuid primary key default gen_random_uuid(), model_id text not null references public.vehicle_models(id),
 location text not null check(location in ('Nellore','Ongole')),
 unit_code text not null unique, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(), model_id text not null references public.vehicle_models(id),
 unit_id uuid references public.vehicle_units(id), location text not null check(location in ('Nellore','Ongole')),
 customer_name text not null, customer_phone text not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 quoted_price integer not null check(quoted_price>=0),
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','cancelled','completed')),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check(status<>'confirmed' or unit_id is not null)
);
-- Same physical unit cannot have overlapping confirmed bookings. End time is exclusive.
alter table public.bookings drop constraint if exists no_double_bookings;
alter table public.bookings add constraint no_double_bookings exclude using gist (
 unit_id with =, tstzrange(starts_at,ends_at,'[)') with &&
) where (status='confirmed');
-- Owner membership check. Admin rows must be inserted manually by a trusted service/admin.
create or replace function public.is_ags_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid())
$$;
-- Prevent anonymous clients from directly writing authoritative inventory or bookings.
alter table public.admin_users enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_units enable row level security;
alter table public.bookings enable row level security;
create policy "models read" on public.vehicle_models for select using (active or public.is_ags_admin());
create policy "admin models" on public.vehicle_models for all to authenticated using (public.is_ags_admin()) with check (public.is_ags_admin());
create policy "admin units" on public.vehicle_units for all to authenticated using (public.is_ags_admin()) with check (public.is_ags_admin());
create policy "admin bookings" on public.bookings for all to authenticated using (public.is_ags_admin()) with check (public.is_ags_admin());
create policy "admin membership read" on public.admin_users for select to authenticated using (auth.uid()=user_id);
-- Public availability: aggregate only, never expose customer names/phones.
create or replace function public.available_unit_count(p_model_id text,p_location text,p_start timestamptz,p_end timestamptz)
 returns integer language sql stable security definer set search_path=public as $$
 select count(*)::integer from public.vehicle_units u
 where u.model_id=p_model_id and u.location=p_location and u.active
 and p_end>p_start
 and not exists(select 1 from public.bookings b where b.unit_id=u.id and b.status='confirmed'
   and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_start,p_end,'[)'))
$$;
-- A separate server-side validated, rate-limited public-request endpoint is REQUIRED.
-- Do not expose INSERT on bookings to anon. Confirmation must be performed by
-- an authenticated admin under a single database transaction, and validate
-- that the unit belongs to the requested model & location before confirming.
insert into public.vehicle_models(id,name,category,same_day_price,day_price) values
('ags-01','Activa','Scooter',400,500),('ags-02','Activa 125','Scooter',400,500),
('ags-03','Dio','Scooter',500,600),('ags-04','Fascino','Scooter',400,500),
('ags-05','Destini 125','Scooter',400,500),('ags-06','Jupiter','Scooter',500,600),
('ags-07','Jupiter BS4','Scooter',400,500),('ags-08','Ntorq','Scooter',500,600),
('ags-09','Platina','Motorcycle',300,400),('ags-10','Splendor','Motorcycle',300,400),
('ags-11','Glamour','Motorcycle',300,400),('ags-12','Unicorn','Motorcycle',400,500),
('ags-13','Avenger','Motorcycle',400,500),('ags-14','RTR 160 4V','Motorcycle',500,600),
('ags-15','FZ-S V2','Motorcycle',500,600),('ags-16','Pulsar','Motorcycle',600,700),
('ags-17','FZ-S','Motorcycle',600,700)
on conflict(id) do update set name=excluded.name,category=excluded.category,same_day_price=excluded.same_day_price,day_price=excluded.day_price;

-- MIGRATION 2: authenticated administrator booking transition with atomic allocation.
-- Runs as function owner; all changes require verified admin membership.
create or replace function public.ags_update_booking(p_booking_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype; assigned uuid;
begin
 if not public.is_ags_admin() then raise exception 'Administrator access required'; end if;
 if p_status not in ('confirmed','rejected','cancelled','completed') then raise exception 'Invalid status'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Booking not found'; end if;
 if p_status='confirmed' then
  if b.status<>'pending' then raise exception 'Only pending requests can be confirmed'; end if;
  select u.id into assigned from public.vehicle_units u
   where u.model_id=b.model_id and u.location=b.location and u.active=true
    and not exists(select 1 from public.bookings x where x.unit_id=u.id and x.status='confirmed'
      and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)'))
   order by u.created_at,u.id for update skip locked limit 1;
  if assigned is null then raise exception 'No physical unit available for these dates'; end if;
  update public.bookings set status='confirmed',unit_id=assigned where id=b.id;
 else
  if b.status not in ('pending','confirmed') then raise exception 'Booking cannot transition from %',b.status; end if;
  if p_status='completed' and b.status<>'confirmed' then raise exception 'Only confirmed bookings can be completed';end if;
  update public.bookings set status=p_status where id=b.id;
 end if;
 return jsonb_build_object('id',b.id,'status',p_status,'unit_id',assigned);
end;
$$;
revoke all on function public.ags_update_booking(uuid,text) from public,anon;
grant execute on function public.ags_update_booking(uuid,text) to authenticated;
-- Restrict public inventory function to anonymous aggregate access only.
grant execute on function public.available_unit_count(text,text,timestamptz,timestamptz) to anon,authenticated;

-- MIGRATION 3: server-only anonymous enquiry throttle. The Edge Function uses
-- the service-role secret. No browser-side role can read or write this table.
create table if not exists public.ags_booking_rate_limits (
 ip_hash text primary key,
 window_start timestamptz not null default now(),
 requests integer not null default 0
);
alter table public.ags_booking_rate_limits enable row level security;
create or replace function public.ags_booking_rate_check(p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Server-only rate limit'; end if;
 if length(p_ip_hash) <> 64 then raise exception 'Invalid client identifier'; end if;
 insert into public.ags_booking_rate_limits (ip_hash,window_start,requests)
 values (p_ip_hash,now(),1)
 on conflict(ip_hash) do update set
 window_start=case when public.ags_booking_rate_limits.window_start < now()-interval '1 hour' then now() else public.ags_booking_rate_limits.window_start end,
 requests=case when public.ags_booking_rate_limits.window_start < now()-interval '1 hour' then 1 else public.ags_booking_rate_limits.requests+1 end
 returning requests into n;
 return n<=5;
end;
$$;
revoke all on function public.ags_booking_rate_check(text) from public,anon,authenticated;
grant execute on function public.ags_booking_rate_check(text) to service_role;
