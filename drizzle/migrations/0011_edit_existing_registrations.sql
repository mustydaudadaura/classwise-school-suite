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
  fields:=CASE _table WHEN 'classes' THEN ARRAY['name','level','arm','section'] WHEN 'subjects' THEN ARRAY['name','code','class_id'] ELSE ARRAY['admission_no','first_name','last_name','middle_name','gender','dob','class_id'] END;
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