-- Additive migration: expand student registration/profile editing fields and safe student deletion for School Admins & Super Admins
CREATE OR REPLACE FUNCTION public.review_pending_registration(_table text,_id uuid,_action text,_changes jsonb DEFAULT '{}'::jsonb,_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE row_data jsonb; result jsonb; sid uuid; fields text[]; key text; assignments text:='';
BEGIN
 IF auth.uid() IS NULL OR _table NOT IN ('classes','subjects','students') OR _action NOT IN ('edit','reject') THEN RAISE EXCEPTION 'Invalid registration review'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',_table) INTO row_data USING _id;
 sid:=(row_data->>'school_id')::uuid;
 IF row_data IS NULL OR NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'School administrator access required'; END IF;
 IF _action='reject' AND (NOT (row_data->>'pending_activation')::boolean OR (row_data->>'active')::boolean) THEN RAISE EXCEPTION 'Only pending registrations can be rejected'; END IF;
 IF _action='reject' THEN
  IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  EXECUTE format('UPDATE public.%I t SET pending_activation=false,active=false,rejection_reason=$2,rejected_at=now(),reviewed_by=auth.uid() WHERE id=$1 RETURNING to_jsonb(t)',_table) INTO result USING _id,trim(_reason);
 ELSE
  fields:=CASE _table
   WHEN 'classes' THEN ARRAY['name','level','arm','section']
   WHEN 'subjects' THEN ARRAY['name','code','class_id']
   ELSE ARRAY['admission_no','first_name','last_name','middle_name','gender','dob','class_id','photo_url','status','blood_group','genotype','allergies','medical_notes','state_of_origin','lga','religion','address','previous_school','house','emergency_contact_name','emergency_contact_phone']
  END;
  IF _changes IS NULL OR jsonb_typeof(_changes)<>'object' OR _changes='{}'::jsonb THEN RAISE EXCEPTION 'No changes supplied'; END IF;
  FOR key IN SELECT jsonb_object_keys(_changes) LOOP
   IF NOT key=ANY(fields) THEN RAISE EXCEPTION 'Field cannot be edited: %',key; END IF;
   assignments:=assignments || CASE WHEN assignments='' THEN '' ELSE ',' END || format('%I=p.%I',key,key);
  END LOOP;
  row_data:=row_data || _changes;
  IF (_table IN ('classes','subjects') AND coalesce(trim(row_data->>'name'),'')='') OR (_table='students' AND (coalesce(trim(row_data->>'admission_no'),'')='' OR coalesce(trim(row_data->>'first_name'),'')='' OR coalesce(trim(row_data->>'last_name'),'')='')) THEN RAISE EXCEPTION 'Required registration fields cannot be empty'; END IF;
  IF _table IN ('students','subjects') AND row_data->>'class_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.classes WHERE id=(row_data->>'class_id')::uuid AND school_id=sid AND active AND NOT pending_activation) THEN RAISE EXCEPTION 'Choose an approved class in the same school'; END IF;
  EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$2) p WHERE t.id=$1 RETURNING to_jsonb(t)',_table,assignments,_table) INTO result USING _id,row_data;
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.manage_registry_item(_table text,_id uuid,_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data jsonb; sid uuid; fk record; predicate text; linked boolean; has_history boolean:=false;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF _table NOT IN ('schools','classes','subjects','students','campuses','user_roles','school_custom_roles','school_role_assignments') OR _action NOT IN ('deactivate','reactivate','delete') THEN RAISE EXCEPTION 'Invalid action'; END IF;
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
  IF _table='students' THEN
   SELECT (
    EXISTS(SELECT 1 FROM public.assessments WHERE student_id=_id) OR
    EXISTS(SELECT 1 FROM public.report_cards WHERE student_id=_id) OR
    EXISTS(SELECT 1 FROM public.attendance WHERE student_id=_id) OR
    EXISTS(SELECT 1 FROM public.fee_invoices WHERE student_id=_id) OR
    EXISTS(SELECT 1 FROM public.fee_payments WHERE student_id=_id)
   ) INTO has_history;
   IF has_history THEN
    RAISE EXCEPTION 'This item has linked records or school history. Deactivate it instead.';
   END IF;
   DELETE FROM public.student_parents WHERE student_id=_id;
   DELETE FROM public.student_enrollments WHERE student_id=_id;
   UPDATE public.admissions SET student_id=NULL WHERE student_id=_id;
  END IF;
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
