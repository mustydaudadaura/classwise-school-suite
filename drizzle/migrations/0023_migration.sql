-- Only school administrators (and Super Admins) may register classes, subjects and general student admissions.
-- Form masters keep their own-class admission path (form_master_admit_student), which stays inactive until admin activation.
CREATE OR REPLACE FUNCTION public.can_submit_school_registration(_user_id uuid, _school_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT _user_id IS NOT NULL AND public.can_manage_school(_user_id,_school_id); $$;

CREATE OR REPLACE FUNCTION public.can_submit_school_subject(_user_id uuid, _school_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT _user_id IS NOT NULL AND public.can_manage_school(_user_id,_school_id); $$;