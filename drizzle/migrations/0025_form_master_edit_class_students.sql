CREATE OR REPLACE FUNCTION public.guard_form_master_student_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF public.school_permission(auth.uid(), OLD.school_id, 'students.edit') OR public.school_permission(auth.uid(), OLD.school_id, 'promotion.edit') THEN RETURN NEW; END IF;
 IF NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.school_id IS DISTINCT FROM OLD.school_id THEN
  RAISE EXCEPTION 'Only a school administrator can change a student''s class, status or login account';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_form_master_student_edit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS student_form_master_edit_guard ON public.students;
CREATE TRIGGER student_form_master_edit_guard BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_form_master_student_edit();

DROP POLICY IF EXISTS "Form master edits class students" ON public.students;
CREATE POLICY "Form master edits class students" ON public.students
FOR UPDATE TO authenticated
USING (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id))
WITH CHECK (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id));