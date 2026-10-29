CREATE OR REPLACE FUNCTION public.require_approved_registry_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data jsonb:=to_jsonb(NEW); old_data jsonb; ref uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_data:=to_jsonb(OLD);
  IF (row_data->>'class_id') IS NOT DISTINCT FROM (old_data->>'class_id') AND (row_data->>'subject_id') IS NOT DISTINCT FROM (old_data->>'subject_id') AND (row_data->>'student_id') IS NOT DISTINCT FROM (old_data->>'student_id') THEN RETURN NEW; END IF;
 END IF;
 ref:=(row_data->>'class_id')::uuid;
 IF ref IS NOT NULL AND EXISTS(SELECT 1 FROM public.classes WHERE id=ref AND pending_activation) THEN RAISE EXCEPTION 'Administrator activation is required before using this class'; END IF;
 ref:=(row_data->>'subject_id')::uuid;
 IF ref IS NOT NULL AND EXISTS(SELECT 1 FROM public.subjects WHERE id=ref AND pending_activation) THEN RAISE EXCEPTION 'Administrator activation is required before using this subject'; END IF;
 ref:=(row_data->>'student_id')::uuid;
 IF ref IS NOT NULL AND EXISTS(SELECT 1 FROM public.students WHERE id=ref AND pending_activation) THEN RAISE EXCEPTION 'Administrator activation is required before using this student admission'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_approved_registry_links() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.teacher_allocations FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.fee_items FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.fee_invoices FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.lesson_notes FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.islamic_enrollments FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();
CREATE TRIGGER approved_registry_links BEFORE INSERT OR UPDATE ON public.tahfiz_records FOR EACH ROW EXECUTE FUNCTION public.require_approved_registry_links();