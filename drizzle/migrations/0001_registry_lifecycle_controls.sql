ALTER TABLE public.schools ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.classes ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.subjects ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.students ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_roles ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.school_custom_roles ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.school_role_assignments ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin' AND active) $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND active) $$;
CREATE OR REPLACE FUNCTION public.can_manage_school(_user_id uuid,_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_super_admin(_user_id) OR (EXISTS(SELECT 1 FROM public.user_roles r JOIN public.schools s ON s.id=r.school_id WHERE r.user_id=_user_id AND r.school_id=_school_id AND r.role='school_admin' AND r.active AND s.active AND s.code<>'DEMO001')) $$;
CREATE OR REPLACE FUNCTION public.school_module_enabled(_school_id uuid,_module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.schools WHERE id=_school_id AND active) AND _module=ANY(COALESCE((SELECT enabled_modules FROM public.school_controls WHERE school_id=_school_id),ARRAY['students','academics','promotion','results','attendance','fees','communication'])) $$;
CREATE OR REPLACE FUNCTION public.school_permission(_user_id uuid,_school_id uuid,_permission text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _module text:=split_part(_permission,'.',1);
BEGIN
 IF _user_id IS NULL THEN RETURN false; END IF;
 IF public.is_super_admin(_user_id) THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=_school_id AND active) THEN RETURN false; END IF;
 IF _module IN ('settings','users','audit') THEN RETURN public.can_manage_school(_user_id,_school_id); END IF;
 IF _module NOT IN ('staffatt','payroll') AND NOT public.school_module_enabled(_school_id,_module) THEN RETURN false; END IF;
 IF public.can_manage_school(_user_id,_school_id) THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND active AND ((role='teacher' AND _permission=ANY(ARRAY['students.view','academics.view','results.view','results.edit','attendance.view','attendance.edit'])) OR (role='accountant' AND _permission=ANY(ARRAY['students.view','academics.view','fees.view','fees.edit','payroll.view'])))) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.school_role_assignments a JOIN public.school_custom_roles r ON r.id=a.role_id AND r.school_id=a.school_id WHERE a.user_id=_user_id AND a.school_id=_school_id AND a.active AND r.active AND (_permission=ANY(r.permissions) OR (_permission IN ('students.view','academics.view') AND r.permissions && ARRAY['results.view','results.edit','results.publish','attendance.view','attendance.edit','fees.view','fees.edit','communication.view','communication.edit','promotion.edit'])));
END $$;
CREATE OR REPLACE FUNCTION public.is_school_staff(_user_id uuid,_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_super_admin(_user_id) OR EXISTS(SELECT 1 FROM public.user_roles r JOIN public.schools s ON s.id=r.school_id WHERE r.user_id=_user_id AND r.school_id=_school_id AND r.role IN ('school_admin','teacher','accountant') AND r.active AND s.active) $$;
CREATE OR REPLACE FUNCTION public.manages_school_finance(_user_id uuid,_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_manage_school(_user_id,_school_id) $$;
CREATE OR REPLACE FUNCTION public.teaches_class(_user_id uuid,_class_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.teacher_allocations a JOIN public.classes c ON c.id=a.class_id WHERE a.teacher_id=_user_id AND a.class_id=_class_id AND c.active AND public.is_school_staff(_user_id,a.school_id)) $$;
CREATE OR REPLACE FUNCTION public.protect_registry_active() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.active=OLD.active THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.active THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL AND current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can change school status'; END IF;
 ELSE
  sid:=(to_jsonb(NEW)->>'school_id')::uuid;
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Only a school administrator can change record status'; END IF;
  IF TG_TABLE_NAME='user_roles' AND (NEW.user_id=auth.uid() OR NEW.role='super_admin') THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['schools','classes','subjects','students','user_roles','school_custom_roles','school_role_assignments'] LOOP EXECUTE format('CREATE TRIGGER registry_active_guard BEFORE INSERT OR UPDATE OF active ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_registry_active()',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.manage_registry_item(_table text,_id uuid,_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data jsonb; sid uuid; fk record; predicate text; linked boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF _table NOT IN ('schools','classes','subjects','students','user_roles','school_custom_roles','school_role_assignments') OR _action NOT IN ('deactivate','reactivate','delete') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',_table) INTO row_data USING _id;
 IF row_data IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 sid:=CASE WHEN _table='schools' THEN _id ELSE (row_data->>'school_id')::uuid END;
 IF _table='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can manage schools'; END IF;
 ELSE
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Administrator access required for this school'; END IF;
 END IF;
 IF _table='user_roles' AND ((row_data->>'user_id')::uuid=auth.uid() OR row_data->>'role'='super_admin') THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
 IF _action='delete' THEN
  FOR fk IN SELECT conrelid,conkey,confkey FROM pg_constraint WHERE contype='f' AND confrelid=format('public.%I',_table)::regclass LOOP
   SELECT string_agg(format('child.%I=parent.%I',a.attname,b.attname),' AND ') INTO predicate FROM unnest(fk.conkey,fk.confkey) AS keys(c,p) JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=keys.c JOIN pg_attribute b ON b.attrelid=format('public.%I',_table)::regclass AND b.attnum=keys.p;
   EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',fk.conrelid::regclass);
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s child JOIN public.%I parent ON %s WHERE parent.id=$1)',fk.conrelid::regclass,_table,predicate) INTO linked USING _id;
   IF linked THEN RAISE EXCEPTION 'This item has linked records or school history. Deactivate it instead.'; END IF;
  END LOOP;
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',_table) USING _id;
 ELSE
  EXECUTE format('UPDATE public.%I SET active=$2 WHERE id=$1',_table) USING _id,_action='reactivate';
 END IF;
 RETURN jsonb_build_object('id',_id,'action',_action);
END $$;
REVOKE ALL ON FUNCTION public.manage_registry_item(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_registry_item(text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_registry_active() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_registry_active() TO service_role;
CREATE TRIGGER classes_registry_audit AFTER INSERT OR UPDATE OR DELETE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER subjects_registry_audit AFTER INSERT OR UPDATE OR DELETE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER students_registry_audit AFTER INSERT OR UPDATE OR DELETE ON public.students FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();