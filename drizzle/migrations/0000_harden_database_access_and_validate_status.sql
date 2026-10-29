DO $$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature, p.proname, p.prorettype FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
  IF f.proname <> 'verify_report_card' THEN
   EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END IF;
  IF f.prorettype='trigger'::regtype OR f.proname='find_parent_by_phone' THEN
   EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.signature);
  END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
 END LOOP;
END $$;
ALTER TABLE public.students VALIDATE CONSTRAINT students_status_check;
COMMENT ON FUNCTION public.find_parent_by_phone(text) IS 'Server-only phone lookup; callers must use the authenticated application gateway or parent sign-in endpoint.';