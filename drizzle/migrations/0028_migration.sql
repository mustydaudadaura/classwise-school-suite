CREATE OR REPLACE FUNCTION public.report_subject_positions(_report_id uuid)
 RETURNS TABLE(subject_id uuid, subject_position bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.report_cards;
BEGIN
 SELECT * INTO r FROM public.report_cards WHERE id=_report_id;
 IF r.id IS NULL THEN RETURN; END IF;
 IF NOT (auth.role()='service_role' OR public.school_permission(auth.uid(),r.school_id,'results.view') OR (r.published AND (public.is_parent_of_student(auth.uid(),r.student_id) OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=r.student_id AND s.user_id=auth.uid())))) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 -- Every saved score counts for subject positions; approval is optional.
 RETURN QUERY SELECT ranked.subject_id,ranked.pos FROM (
 SELECT a.subject_id,a.student_id,rank() OVER(PARTITION BY a.subject_id ORDER BY a.total DESC NULLS LAST) pos
 FROM public.assessments a WHERE a.school_id=r.school_id AND a.class_id=r.class_id AND a.session=r.session AND a.term=r.term
   AND (a.ca1 IS NOT NULL OR a.ca2 IS NOT NULL OR a.exam IS NOT NULL OR coalesce(a.total,0) > 0)
 ) ranked WHERE ranked.student_id=r.student_id;
END $function$;