CREATE POLICY "Form master adds guardians" ON public.parents FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.school_id = parents.school_id AND public.is_form_master(auth.uid(), c.id)));
CREATE POLICY "Form master reads class guardians" ON public.parents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.student_parents sp JOIN public.students s ON s.id = sp.student_id WHERE sp.parent_id = parents.id AND public.is_form_master(auth.uid(), s.class_id)));
CREATE POLICY "Form master edits class guardians" ON public.parents FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.student_parents sp JOIN public.students s ON s.id = sp.student_id WHERE sp.parent_id = parents.id AND public.is_form_master(auth.uid(), s.class_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.school_id = parents.school_id AND public.is_form_master(auth.uid(), c.id)));
CREATE POLICY "Form master links class guardians" ON public.student_parents FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.students s JOIN public.parents p ON p.id = student_parents.parent_id WHERE s.id = student_parents.student_id AND p.school_id = s.school_id AND public.is_form_master(auth.uid(), s.class_id)));
CREATE POLICY "Form master updates class guardian links" ON public.student_parents FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_parents.student_id AND public.is_form_master(auth.uid(), s.class_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_parents.student_id AND public.is_form_master(auth.uid(), s.class_id)));
CREATE POLICY "Form master reads class guardian links" ON public.student_parents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_parents.student_id AND public.is_form_master(auth.uid(), s.class_id)));