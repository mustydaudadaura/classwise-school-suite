CREATE OR REPLACE FUNCTION public.protect_registry_active() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; row_data jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.active=OLD.active THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.active THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL AND current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 row_data:=to_jsonb(NEW);
 IF TG_TABLE_NAME='schools' THEN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only Super Admin can change school status'; END IF;
 ELSE
  sid:=(row_data->>'school_id')::uuid;
  IF NOT public.can_manage_school(auth.uid(),sid) THEN RAISE EXCEPTION 'Only a school administrator can change record status'; END IF;
  IF TG_TABLE_NAME='user_roles' THEN
   IF (row_data->>'user_id')::uuid=auth.uid() OR row_data->>'role'='super_admin' THEN RAISE EXCEPTION 'Your own access and Super Admin roles are protected'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;