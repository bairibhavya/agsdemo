-- Change 6: administrator-controlled rental extension. Run after existing supabase.sql and supabase-FINAL-MIGRATION.sql.
-- Existing booking records and schema are preserved. The exclusion constraint prevents overlapping confirmed rentals.
create or replace function public.ags_extend_booking(p_booking_id uuid,p_new_end timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype; m public.vehicle_models%rowtype; rental_hours numeric; days_count integer; total_price integer;
begin
 if not public.is_ags_admin() then raise exception 'Administrator access required'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Booking not found'; end if;
 if b.status<>'confirmed' or b.unit_id is null then raise exception 'Only confirmed rentals can be extended'; end if;
 if p_new_end is null or p_new_end<=b.ends_at then raise exception 'Select a return time after the current booking end'; end if;
 if p_new_end<=now() then raise exception 'New return time must be in the future'; end if;
 select * into m from public.vehicle_models where id=b.model_id;
 if not found then raise exception 'Vehicle model not found'; end if;
 rental_hours:=extract(epoch from (p_new_end-b.starts_at))/3600;
 if rental_hours<=14 then total_price:=m.same_day_price;
 else
  days_count:=ceil(rental_hours/24);
  total_price:=(days_count/7)*6*m.day_price + mod(days_count,7)*m.day_price;
 end if;
 -- Existing no_double_bookings exclusion constraint rejects any extension that overlaps another confirmed rental.
 update public.bookings set ends_at=p_new_end,quoted_price=total_price where id=b.id;
 return jsonb_build_object('id',b.id,'ends_at',p_new_end,'quoted_price',total_price);
end;
$$;
revoke all on function public.ags_extend_booking(uuid,timestamptz) from public,anon;
grant execute on function public.ags_extend_booking(uuid,timestamptz) to authenticated;
