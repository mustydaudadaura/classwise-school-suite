ALTER TABLE public.classes ADD COLUMN pending_activation boolean NOT NULL DEFAULT false;
ALTER TABLE public.classes ADD COLUMN submitted_by uuid;
CREATE OR REPLACE FUNCTION public.can_submit_school_registration(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.schools s ON s.id=r.school_id WHERE r.user_id=_user_id AND r.school_id=_school_id AND r.role='teacher' AND r.active AND s.active) AND public.school_module_enabled(_school_id,'students') AND public.school_module_enabled(_school_id,'academics');
$$;
REVOKE ALL ON FUNCTION public.can_submit_school_registration(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_submit_school_registration(uuid,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.protect_registry_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; row_data jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.active=OLD.active THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.active THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL AND current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 row_data:=to_jsonb(NEW); sid:=(row_data->>'school_id')::uuid;
 IF TG_OP='INSERT' AND TG_TABLE_NAME IN ('classes','students') AND NOT NEW.active AND coalesce((row_data->>'pending_activation')::boolean,false) AND public.can_submit_school_registration(auth.uid(),sid) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can change school status'; END IF;
 ELSE
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Only a school administrator can change record status'; END IF;
  IF TG_TABLE_NAME='user_roles' AND ((row_data->>'user_id')::uuid=auth.uid() OR row_data->>'role'='super_admin') THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.protect_registration_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); sid uuid:=NEW.school_id; row_data jsonb:=to_jsonb(NEW); old_data jsonb; creator uuid;
BEGIN
 IF actor IS NULL THEN RETURN NEW; END IF;
 IF public.can_manage_school(actor,sid) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND public.can_submit_school_registration(actor,sid) THEN
  creator:=CASE WHEN TG_TABLE_NAME='classes' THEN (row_data->>'submitted_by')::uuid ELSE (row_data->>'admitted_by')::uuid END;
  IF NEW.active OR NOT NEW.pending_activation OR creator IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Teacher registrations must await administrator activation'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  old_data:=to_jsonb(OLD);
  IF NEW.active IS DISTINCT FROM OLD.active OR NEW.pending_activation IS DISTINCT FROM OLD.pending_activation OR (row_data->>'submitted_by') IS DISTINCT FROM (old_data->>'submitted_by') OR (row_data->>'admitted_by') IS DISTINCT FROM (old_data->>'admitted_by') THEN RAISE EXCEPTION 'Only a school administrator can approve registrations'; END IF;
 END IF;
 IF TG_TABLE_NAME='students' AND NEW.active AND NEW.class_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.classes WHERE id=NEW.class_id AND school_id=sid AND active AND NOT pending_activation) THEN RAISE EXCEPTION 'The class must be approved before activating its students'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_registration_approval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER registration_approval_guard BEFORE INSERT OR UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.protect_registration_approval();
CREATE TRIGGER registration_approval_guard BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.protect_registration_approval();
CREATE POLICY "Teachers submit pending classes" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.can_submit_school_registration(auth.uid(),school_id) AND NOT active AND pending_activation AND submitted_by=auth.uid());
CREATE POLICY "Teachers read their class submissions" ON public.classes FOR SELECT TO authenticated USING (submitted_by=auth.uid() AND public.can_submit_school_registration(auth.uid(),school_id));
CREATE POLICY "Teachers read their admissions" ON public.students FOR SELECT TO authenticated USING (admitted_by=auth.uid() AND public.can_submit_school_registration(auth.uid(),school_id));
CREATE OR REPLACE FUNCTION public.submit_student_admission(_class_id uuid,_admission_no text,_first_name text,_last_name text,_middle_name text,_gender public.gender_type,_dob date,_parent_name text,_parent_phone text,_parent_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; new_id uuid; pid uuid;
BEGIN
 SELECT school_id INTO sid FROM public.classes WHERE id=_class_id AND active AND NOT pending_activation;
 IF sid IS NULL OR NOT public.can_submit_school_registration(auth.uid(),sid) THEN RAISE EXCEPTION 'Choose an approved class in your school'; END IF;
 IF coalesce(trim(_admission_no),'')='' OR coalesce(trim(_first_name),'')='' OR coalesce(trim(_last_name),'')='' THEN RAISE EXCEPTION 'Admission number, first name and last name are required'; END IF;
 INSERT INTO public.students(school_id,class_id,admission_no,first_name,last_name,middle_name,gender,dob,active,pending_activation,admitted_by) VALUES(sid,_class_id,trim(_admission_no),trim(_first_name),trim(_last_name),nullif(trim(coalesce(_middle_name,'')),''),_gender,_dob,false,true,auth.uid()) RETURNING id INTO new_id;
 IF coalesce(trim(_parent_name),'')<>'' THEN
  INSERT INTO public.parents(school_id,full_name,phone,email) VALUES(sid,trim(_parent_name),nullif(trim(coalesce(_parent_phone,'')),''),nullif(trim(coalesce(_parent_email,'')),'')) RETURNING id INTO pid;
  INSERT INTO public.student_parents(student_id,parent_id,is_primary) VALUES(new_id,pid,true);
 END IF;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_student_admission(uuid,text,text,text,text,public.gender_type,date,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_student_admission(uuid,text,text,text,text,public.gender_type,date,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.activate_pending_classes(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.classes SET active=true,pending_activation=false WHERE id=ANY(_ids) AND pending_activation AND public.can_manage_school(auth.uid(),school_id);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.activate_pending_classes(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_pending_classes(uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.activate_pending_students(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.students s SET active=true,pending_activation=false WHERE s.id=ANY(_ids) AND s.pending_activation AND public.can_manage_school(auth.uid(),s.school_id) AND (s.class_id IS NULL OR EXISTS(SELECT 1 FROM public.classes c WHERE c.id=s.class_id AND c.school_id=s.school_id AND c.active AND NOT c.pending_activation));
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;