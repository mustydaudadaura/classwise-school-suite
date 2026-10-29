CREATE TABLE public.attendance_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 150 CHECK (radius_m BETWEEN 20 AND 50000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sites TO authenticated;
GRANT ALL ON public.attendance_sites TO service_role;
ALTER TABLE public.attendance_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_read ON public.attendance_sites FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY site_write ON public.attendance_sites FOR ALL TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit'))
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE INDEX attendance_sites_school_idx ON public.attendance_sites(school_id);