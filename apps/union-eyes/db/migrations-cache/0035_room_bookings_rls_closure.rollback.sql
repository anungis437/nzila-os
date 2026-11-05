-- 0035_room_bookings_rls_closure rollback: removes the policies and row security from room_bookings. Run only with the booking route disabled; without row security the runtime grant would expose every organization's bookings.
DO $$ BEGIN
  IF to_regclass('public.room_bookings') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.room_bookings;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.room_bookings;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.room_bookings;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.room_bookings;
    DROP POLICY IF EXISTS ue_system_full_access ON public.room_bookings;
    ALTER TABLE public.room_bookings NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.room_bookings DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
