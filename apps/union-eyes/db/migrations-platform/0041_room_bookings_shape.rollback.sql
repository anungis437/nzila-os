-- Rollback for 0041_room_bookings_shape: forward recovery only. The added columns are nullable and may hold bookings; drop them only after export.
DROP TRIGGER IF EXISTS trg_room_bookings_no_overlap ON public.room_bookings;
DROP FUNCTION IF EXISTS public.enforce_room_booking_no_overlap();
ALTER TABLE public.room_bookings DROP CONSTRAINT IF EXISTS room_bookings_time_order;
DROP INDEX IF EXISTS public.idx_room_bookings_room_time;
DROP INDEX IF EXISTS public.idx_room_bookings_org;
