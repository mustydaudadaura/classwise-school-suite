CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  phone text,
  email text,
  role text NOT NULL DEFAULT 'teacher',
  staff_no text,
  department text,
  job_title text,
  photo_url text,
  monthly_salary numeric NOT NULL DEFAULT 0,
  bank_name text,
  account_number text,
  account_name text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_members_role_chk CHECK (role IN ('school_admin','teacher','accountant','non_teaching')),
  CONSTRAINT staff_members_salary_chk CHECK (monthly_salary >= 0),
  CONSTRAINT staff_members_name_chk CHECK (length(btrim(full_name)) > 0)
);
CREATE UNIQUE INDEX staff_members_school_staffno_uq ON public.staff_members (school_id, lower(staff_no)) WHERE staff_no IS NOT NULL;
CREATE UNIQUE INDEX staff_members_school_user_uq ON public.staff_members (school_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX staff_members_school_idx ON public.staff_members (school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins read staff register" ON public.staff_members FOR SELECT TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id));
CREATE POLICY "School admins add staff" ON public.staff_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school(auth.uid(), school_id));
CREATE POLICY "School admins edit staff" ON public.staff_members FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id));
CREATE POLICY "School admins remove staff" ON public.staff_members FOR DELETE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id));

CREATE TRIGGER staff_members_updated_at BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER staff_members_audit AFTER INSERT OR UPDATE OR DELETE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();