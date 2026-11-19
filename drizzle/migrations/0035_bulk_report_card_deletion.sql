GRANT DELETE ON public.report_cards TO authenticated;
CREATE POLICY "Administrators delete generated report cards" ON public.report_cards FOR DELETE TO authenticated USING (public.can_manage_school(auth.uid(), school_id));
CREATE OR REPLACE FUNCTION public.delete_generated_report_cards(_school_id uuid, _report_ids uuid[], _confirmation text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE expected integer; removed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_school(auth.uid(), _school_id) THEN RAISE EXCEPTION 'Only school administrators can delete report cards'; END IF;
 IF _confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Type DELETE to confirm'; END IF;
 IF cardinality(_report_ids) IS NULL OR cardinality(_report_ids) < 1 OR cardinality(_report_ids) > 50000 THEN RAISE EXCEPTION 'Select between 1 and 50000 report cards'; END IF;
 SELECT count(DISTINCT id) INTO expected FROM unnest(_report_ids) AS ids(id);
 PERFORM id FROM public.report_cards WHERE school_id = _school_id AND id = ANY(_report_ids) FOR UPDATE;
 IF (SELECT count(*) FROM public.report_cards WHERE school_id = _school_id AND id = ANY(_report_ids)) <> expected THEN RAISE EXCEPTION 'Some selected report cards are missing or belong to another school. Refresh and select again.'; END IF;
 DELETE FROM public.report_cards WHERE school_id = _school_id AND id = ANY(_report_ids);
 GET DIAGNOSTICS removed = ROW_COUNT;
 IF removed <> expected THEN RAISE EXCEPTION 'Report cards were not deleted. Please refresh and try again.'; END IF;
 RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_generated_report_cards(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_generated_report_cards(uuid, uuid[], text) TO authenticated, service_role;