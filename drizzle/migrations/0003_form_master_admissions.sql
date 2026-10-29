ALTER TABLE public.students ADD COLUMN IF NOT EXISTS pending_activation boolean NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admitted_by uuid;

CREATE OR REPLACE FUNCTION public.is_form_master(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = _class_id AND c.active AND public.is_school_staff(_user_id, c.school_id)
      AND (c.teacher_id = _user_id OR EXISTS (
        SELECT 1 FROM public.teacher_allocations a
        WHERE a.class_id = c.id AND a.teacher_id = _user_id AND a.is_class_teacher))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_form_master(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_form_master(uuid, uuid) TO authenticated;

CREATE POLICY "Form master reads class students" ON public.students FOR SELECT TO authenticated
  USING (class_id IS NOT NULL AND public.is_form_master(auth.uid(), class_id));

CREATE OR REPLACE FUNCTION public.form_master_admit_student(
  _class_id uuid, _admission_no text, _first_name text, _last_name text, _middle_name text,
  _gender public.gender_type, _dob date, _parent_name text, _parent_phone text, _parent_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; new_id uuid; pid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_form_master(auth.uid(), _class_id) THEN
    RAISE EXCEPTION 'Only the form master of this class can admit students into it';
  END IF;
  IF coalesce(trim(_admission_no),'') = '' OR coalesce(trim(_first_name),'') = '' OR coalesce(trim(_last_name),'') = '' THEN
    RAISE EXCEPTION 'Admission number, first name and last name are required';
  END IF;
  SELECT school_id INTO sid FROM public.classes WHERE id = _class_id;
  INSERT INTO public.students (school_id, class_id, admission_no, first_name, last_name, middle_name, gender, dob, active, pending_activation, admitted_by)
  VALUES (sid, _class_id, trim(_admission_no), trim(_first_name), trim(_last_name), nullif(trim(coalesce(_middle_name,'')),''), _gender, _dob, false, true, auth.uid())
  RETURNING id INTO new_id;
  IF coalesce(trim(_parent_name),'') <> '' THEN
    INSERT INTO public.parents (school_id, full_name, phone, email)
    VALUES (sid, trim(_parent_name), nullif(trim(coalesce(_parent_phone,'')),''), nullif(trim(coalesce(_parent_email,'')),''))
    RETURNING id INTO pid;
    INSERT INTO public.student_parents (student_id, parent_id, is_primary) VALUES (new_id, pid, true);
  END IF;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.form_master_admit_student(uuid,text,text,text,text,public.gender_type,date,text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.form_master_admit_student(uuid,text,text,text,text,public.gender_type,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_pending_students(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.students SET active = true, pending_activation = false
  WHERE id = ANY(_ids) AND pending_activation AND public.can_manage_school(auth.uid(), school_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.activate_pending_students(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_pending_students(uuid[]) TO authenticated;