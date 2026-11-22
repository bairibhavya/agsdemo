-- AGS final additive migration. Run in Supabase SQL Editor after taking a database backup.
-- DOES NOT delete bookings, users, or units. Idempotent for existing schema.

-- Stable public-facing sequential references (existing rows also receive a number).
create sequence if not exists public.ags_booking_ref_seq start with 1001;
alter table public.bookings add column if not exists booking_number bigint;
alter table public.bookings alter column booking_number set default nextval('public.ags_booking_ref_seq');
update public.bookings set booking_number=nextval('public.ags_booking_ref_seq') where booking_number is null;
create unique index if not exists ags_booking_number_unique on public.bookings(booking_number);
select setval('public.ags_booking_ref_seq', greatest(1001,(select coalesce(max(booking_number),1000) from public.bookings)),(select count(*)>0 from public.bookings));

-- Date/location/model summary, including the latest end time among conflicting confirmed reservations.
-- No customer details or individual unit records are returned to anonymous viewers.
create or replace function public.ags_availability_detail(
 p_model_id text,p_location text,p_start timestamptz,p_end timestamptz)
returns table(available integer, booked_until timestamptz)
language sql stable security definer set search_path=public as $$
 select
  public.available_unit_count(p_model_id,p_location,p_start,p_end) as available,
  (select max(b.ends_at) from public.bookings b
    join public.vehicle_units u on u.id=b.unit_id
   where u.model_id=p_model_id and u.location=p_location and u.active
     and b.status='confirmed' and p_start<p_end
     and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_start,p_end,'[)')) as booked_until;
$$;
revoke all on function public.ags_availability_detail(text,text,timestamptz,timestamptz) from public;
grant execute on function public.ags_availability_detail(text,text,timestamptz,timestamptz) to anon,authenticated;

-- Public model photos; only signed-in authorized AGS admins can upload and remove.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vehicle-photos','vehicle-photos',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ags owner uploads bike photos') then
  create policy "ags owner uploads bike photos" on storage.objects for insert to authenticated
  with check(bucket_id='vehicle-photos' and public.is_ags_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ags owner manages bike photos') then
  create policy "ags owner manages bike photos" on storage.objects for delete to authenticated
  using(bucket_id='vehicle-photos' and public.is_ags_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public reads ags bike photos') then
  create policy "public reads ags bike photos" on storage.objects for select to public
  using(bucket_id='vehicle-photos');
 end if;
end $$;
