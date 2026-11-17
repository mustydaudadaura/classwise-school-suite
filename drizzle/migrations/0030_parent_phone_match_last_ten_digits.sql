CREATE OR REPLACE FUNCTION public.find_parent_by_phone(_phone text)
 RETURNS TABLE(parent_id uuid, school_id uuid, full_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.school_id, p.full_name
    FROM public.parents p
   WHERE length(regexp_replace(_phone, '\D', '', 'g')) >= 10
     AND right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 10) = right(regexp_replace(_phone, '\D', '', 'g'), 10)
   ORDER BY (SELECT count(*) FROM public.student_parents sp WHERE sp.parent_id = p.id) DESC, p.created_at
   LIMIT 1
$function$;
REVOKE EXECUTE ON FUNCTION public.find_parent_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_parent_by_phone(text) TO service_role;