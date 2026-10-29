ALTER TABLE public.subjects ADD COLUMN pending_activation boolean NOT NULL DEFAULT false;
ALTER TABLE public.subjects ADD COLUMN submitted_by uuid;
CREATE OR REPLACE FUNCTION public.can_submit_school_subject(_user_id uuid,_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user_id IS NOT NULL AND public.school_module_enabled(_school_id,'academics') AND EXISTS(SELECT 1 FROM public.schools s WHERE s.id=_school_id AND s.active) AND (public.is_school_staff(_user_id,_school_id) OR EXISTS(SELECT 1 FROM public.school_role_assignments a JOIN public.school_custom_roles r ON r.id=a.role_id AND r.school_id=a.school_id WHERE a.user_id=_user_id AND a.school_id=_school_id AND a.active AND r.active));
$$;
REVOKE ALL ON FUNCTION public.can_submit_school_subject(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_submit_school_subject(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.protect_registry_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; row_data jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.active=OLD.active THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.active THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL AND current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 row_data:=to_jsonb(NEW); sid:=(row_data->>'school_id')::uuid;
 IF TG_OP='INSERT' AND NOT NEW.active AND coalesce((row_data->>'pending_activation')::boolean,false) AND ((TG_TABLE_NAME IN ('classes','students') AND public.can_submit_school_registration(auth.uid(),sid)) OR (TG_TABLE_NAME='subjects' AND public.can_submit_school_subject(auth.uid(),sid))) THEN RETURN NEW; END IF;
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
DECLARE actor uuid:=auth.uid(); sid uuid:=NEW.school_id; row_data jsonb:=to_jsonb(NEW); old_data jsonb; creator uuid; can_submit boolean;
BEGIN
 IF actor IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME IN ('students','subjects') AND NEW.active AND (row_data->>'class_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.classes WHERE id=(row_data->>'class_id')::uuid AND school_id=sid AND active AND NOT pending_activation) THEN RAISE EXCEPTION 'The class must be approved before activating its students or subjects'; END IF;
 IF public.can_manage_school(actor,sid) THEN RETURN NEW; END IF;
 can_submit:=CASE WHEN TG_TABLE_NAME='subjects' THEN public.can_submit_school_subject(actor,sid) ELSE public.can_submit_school_registration(actor,sid) END;
 IF TG_OP='INSERT' AND can_submit THEN
  creator:=CASE WHEN TG_TABLE_NAME IN ('classes','subjects') THEN (row_data->>'submitted_by')::uuid ELSE (row_data->>'admitted_by')::uuid END;
  IF NEW.active OR NOT NEW.pending_activation OR creator IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Staff registrations must await administrator activation'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  old_data:=to_jsonb(OLD);
  IF NEW.active IS DISTINCT FROM OLD.active OR NEW.pending_activation IS DISTINCT FROM OLD.pending_activation OR (row_data->>'submitted_by') IS DISTINCT FROM (old_data->>'submitted_by') OR (row_data->>'admitted_by') IS DISTINCT FROM (old_data->>'admitted_by') THEN RAISE EXCEPTION 'Only a school administrator can approve registrations'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER registration_approval_guard BEFORE INSERT OR UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.protect_registration_approval();
CREATE POLICY "Staff submit pending subjects" ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.can_submit_school_subject(auth.uid(),school_id) AND NOT active AND pending_activation AND submitted_by=auth.uid());
CREATE POLICY "Staff read their subject submissions" ON public.subjects FOR SELECT TO authenticated USING (submitted_by=auth.uid() AND public.can_submit_school_subject(auth.uid(),school_id));
CREATE OR REPLACE FUNCTION public.activate_pending_subjects(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.subjects s SET active=true,pending_activation=false WHERE s.id=ANY(_ids) AND s.pending_activation AND public.can_manage_school(auth.uid(),s.school_id) AND (s.class_id IS NULL OR EXISTS(SELECT 1 FROM public.classes c WHERE c.id=s.class_id AND c.school_id=s.school_id AND c.active AND NOT c.pending_activation));
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.activate_pending_subjects(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_pending_subjects(uuid[]) TO authenticated;