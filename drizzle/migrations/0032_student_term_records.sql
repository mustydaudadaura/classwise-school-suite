CREATE TABLE public.student_term_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session text NOT NULL,
  term public.term_name NOT NULL,
  days_present integer CHECK (days_present IS NULL OR days_present >= 0),
  psychomotor jsonb NOT NULL DEFAULT '{}'::jsonb,
  affective jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_term_records TO authenticated;
GRANT ALL ON public.student_term_records TO service_role;
ALTER TABLE public.student_term_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read term records" ON public.student_term_records FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins or form masters insert term records" ON public.student_term_records FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id) AND public.student_school_id(student_id) = school_id));
CREATE POLICY "Admins or form masters update term records" ON public.student_term_records FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id)))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id) AND public.student_school_id(student_id) = school_id));
CREATE POLICY "Admins delete term records" ON public.student_term_records FOR DELETE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id));
CREATE TRIGGER student_term_records_updated BEFORE UPDATE ON public.student_term_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();