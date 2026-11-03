CREATE OR REPLACE FUNCTION public.capture_school_audit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _old jsonb; _new jsonb; _sid uuid;
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 IF TG_OP<>'INSERT' THEN _old:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN _new:=to_jsonb(NEW); END IF;
 _sid:=COALESCE((_new->>'school_id')::uuid,(_old->>'school_id')::uuid);
 IF TG_TABLE_NAME='schools' THEN _sid:=COALESCE((_new->>'id')::uuid,(_old->>'id')::uuid); END IF;
 IF _sid IS NOT NULL THEN INSERT INTO public.school_audit_logs(school_id,actor_id,action,entity,record_id,old_value,new_value)
 VALUES(_sid,auth.uid(),TG_OP,TG_TABLE_NAME,COALESCE(_new->>'id',_old->>'id',_sid::text),_old,_new); END IF;
 RETURN COALESCE(NEW,OLD);
END $function$;

CREATE OR REPLACE FUNCTION public.guard_registration_rejection()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 IF NEW.rejected_at IS NOT NULL AND (NEW.active OR NEW.pending_activation) THEN RAISE EXCEPTION 'Rejected registrations must remain inactive'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.rejected_at IS NOT NULL OR NEW.rejection_reason IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN RAISE EXCEPTION 'New registrations cannot contain review decisions'; END IF;
 ELSE
  IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
   IF auth.uid() IS NULL OR NOT public.can_manage_school(auth.uid(),OLD.school_id) OR NEW.school_id IS DISTINCT FROM OLD.school_id THEN RAISE EXCEPTION 'Only school administrators can review registrations'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.immutable_fee_payment()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 RAISE EXCEPTION 'Recorded payments cannot be changed or deleted'; END $function$;

CREATE OR REPLACE FUNCTION public.immutable_school_audit()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 RAISE EXCEPTION 'Audit history is append-only'; END $function$;

CREATE OR REPLACE FUNCTION public.protect_assessment_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _can boolean;
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _can := public.school_permission(auth.uid(), NEW.school_id, 'results.publish');
  IF _can THEN
    IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.review_remark IS DISTINCT FROM OLD.review_remark) THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    RAISE EXCEPTION 'Only result approvers can approve results';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' THEN RAISE EXCEPTION 'Approved results are locked. Ask the school admin to return them for correction.'; END IF;
    NEW.review_remark := OLD.review_remark; NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
  ELSE
    NEW.review_remark := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.protect_fee_invoice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE paid_total numeric;
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  NEW.discount_amount := COALESCE(NEW.discount_amount, 0);
  IF NEW.discount_amount < 0 THEN RAISE EXCEPTION 'A discount cannot be negative'; END IF;
  IF NEW.discount_amount > NEW.amount_due THEN RAISE EXCEPTION 'A discount cannot be more than the invoice amount'; END IF;
  IF NEW.discount_amount > 0 AND NULLIF(BTRIM(COALESCE(NEW.discount_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for the discount';
  END IF;
  IF NEW.discount_amount = 0 THEN
    NEW.discount_reason := NULL; NEW.discount_kind := NULL;
    NEW.discount_approved_by := NULL; NEW.discount_approved_at := NULL;
  ELSIF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.discount_approved_by := auth.uid(); NEW.discount_approved_at := now();
    END IF;
  END IF;
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
    SELECT COALESCE(SUM(amount), 0) INTO paid_total FROM public.fee_payments WHERE invoice_id = NEW.id;
    IF paid_total <> NEW.amount_paid THEN
      RAISE EXCEPTION 'Amount paid can only change through recorded payments';
    END IF;
  END IF;
  IF NEW.amount_due < NEW.amount_paid + NEW.discount_amount THEN
    RAISE EXCEPTION 'The invoice total cannot be less than what has been paid and discounted';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.protect_lesson_review()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE is_reviewer boolean := public.school_permission(auth.uid(), NEW.school_id, 'academics.edit');
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT is_reviewer THEN
    NEW.review_score := OLD.review_score; NEW.review_remark := OLD.review_remark;
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := OLD.status; END IF;
    IF OLD.status = 'approved' THEN
      NEW.plan := OLD.plan; NEW.header := OLD.header; NEW.content := OLD.content; NEW.topic := OLD.topic; NEW.status := OLD.status;
    END IF;
  ELSE
    IF NEW.review_remark IS DISTINCT FROM OLD.review_remark OR NEW.review_score IS DISTINCT FROM OLD.review_score OR NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
      IF NEW.review_remark IS DISTINCT FROM OLD.review_remark THEN NEW.acknowledged_at := NULL; END IF;
    END IF;
  END IF;
  IF NEW.created_by <> auth.uid() THEN
    NEW.teacher_reply := OLD.teacher_reply;
    IF NEW.review_remark IS NOT DISTINCT FROM OLD.review_remark THEN NEW.acknowledged_at := OLD.acknowledged_at; END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.protect_profile_identity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 IF auth.uid() IS NOT NULL THEN
 IF TG_OP='INSERT' AND (NEW.user_id<>auth.uid() OR NEW.school_id IS NOT NULL) THEN RAISE EXCEPTION 'School affiliation requires administrator approval'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.school_id IS DISTINCT FROM OLD.school_id) AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only super administrators may change school affiliation'; END IF;
 END IF; RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.protect_registration_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=auth.uid(); sid uuid:=NEW.school_id; row_data jsonb:=to_jsonb(NEW); old_data jsonb; creator uuid; can_submit boolean;
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.protect_registry_active()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid uuid; row_data jsonb;
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.protect_scheme_review()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF current_setting('app.registry_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.school_permission(auth.uid(), NEW.school_id, 'academics.edit') THEN
    NEW.review_remark := OLD.review_remark; NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := OLD.status; END IF;
    IF OLD.status = 'approved' THEN
      NEW.topic := OLD.topic; NEW.sub_topics := OLD.sub_topics; NEW.objectives := OLD.objectives; NEW.week := OLD.week; NEW.term := OLD.term; NEW.status := OLD.status;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.review_remark IS DISTINCT FROM OLD.review_remark THEN
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.registry_purge_rows(_rel regclass, _cond text, _depth int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE fk record; ca text := 't'||_depth; cc text := 't'||(_depth+1); child_cols text; parent_cols text; child_cond text; all_nullable boolean; set_list text;
BEGIN
 IF _depth > 8 THEN RAISE EXCEPTION 'Linked records are nested too deeply to delete'; END IF;
 FOR fk IN SELECT c.conrelid, c.conkey, c.confkey FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE c.contype='f' AND c.confrelid=_rel AND n.nspname='public' LOOP
  SELECT string_agg(format('%I.%I',cc,a.attname),',' ORDER BY k.ord), string_agg(format('%I.%I',ca,b.attname),',' ORDER BY k.ord),
         bool_and(NOT a.attnotnull), string_agg(format('%I=NULL',a.attname),',')
    INTO child_cols, parent_cols, all_nullable, set_list
    FROM unnest(fk.conkey, fk.confkey) WITH ORDINALITY AS k(c,p,ord)
    JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=k.c
    JOIN pg_attribute b ON b.attrelid=_rel AND b.attnum=k.p;
  child_cond := format('(%s) IN (SELECT %s FROM %s %I WHERE %s)', child_cols, parent_cols, _rel, ca, _cond);
  IF fk.conrelid = _rel OR all_nullable THEN
   EXECUTE format('UPDATE %s %I SET %s WHERE %s', fk.conrelid::regclass, cc, set_list, child_cond);
  ELSE
   PERFORM public.registry_purge_rows(fk.conrelid::regclass, child_cond, _depth+1);
  END IF;
 END LOOP;
 EXECUTE format('DELETE FROM %s %I WHERE %s', _rel, ca, _cond);
END $fn$;
REVOKE ALL ON FUNCTION public.registry_purge_rows(regclass, text, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.manage_registry_item(_table text, _id uuid, _action text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE row_data jsonb; sid uuid; fk record; predicate text; linked boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF _table NOT IN ('schools','classes','subjects','students','user_roles','school_custom_roles','school_role_assignments') OR _action NOT IN ('deactivate','reactivate','delete','purge') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',_table) INTO row_data USING _id;
 IF row_data IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 sid:=CASE WHEN _table='schools' THEN _id ELSE (row_data->>'school_id')::uuid END;
 IF _table='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can manage schools'; END IF;
 ELSE
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Administrator access required for this school'; END IF;
 END IF;
 IF _table='user_roles' AND ((row_data->>'user_id')::uuid=auth.uid() OR row_data->>'role'='super_admin') THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
 IF _action='purge' THEN
  PERFORM set_config('app.registry_purge','on',true);
  PERFORM public.registry_purge_rows(format('public.%I',_table)::regclass, format('t0.id=%L::uuid',_id), 0);
  PERFORM set_config('app.registry_purge','off',true);
  IF _table<>'schools' THEN
   INSERT INTO public.school_audit_logs(school_id,actor_id,action,entity,record_id,old_value)
   VALUES (sid,auth.uid(),'permanent_delete',_table,_id::text,row_data);
  END IF;
 ELSIF _action='delete' THEN
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
END $function$;