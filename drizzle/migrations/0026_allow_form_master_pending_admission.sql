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
 IF TG_OP='INSERT' AND TG_TABLE_NAME='students' AND NOT NEW.active AND coalesce((row_data->>'pending_activation')::boolean,false)
    AND (row_data->>'class_id') IS NOT NULL AND (row_data->>'admitted_by')::uuid = auth.uid()
    AND public.is_form_master(auth.uid(), (row_data->>'class_id')::uuid)
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id=(row_data->>'class_id')::uuid AND c.school_id=sid) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can change school status'; END IF;
 ELSE
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Only a school administrator can change record status'; END IF;
  IF TG_TABLE_NAME='user_roles' AND ((row_data->>'user_id')::uuid=auth.uid() OR row_data->>'role'='super_admin') THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
 END IF;
 RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.protect_registry_active() FROM PUBLIC, anon, authenticated;