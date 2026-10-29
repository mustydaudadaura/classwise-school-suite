DROP POLICY IF EXISTS "Anyone can view schools (for signup)" ON public.schools;
CREATE POLICY "Members view their schools" ON public.schools FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.in_same_school(auth.uid(), id));
CREATE POLICY "Public view active schools" ON public.schools FOR SELECT TO anon
  USING (active = true);

CREATE OR REPLACE FUNCTION public.storage_school_folder(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN (storage.foldername(_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN ((storage.foldername(_name))[1])::uuid ELSE NULL END
$$;

DROP POLICY IF EXISTS "Authenticated upload school-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update school-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read school-assets" ON storage.objects;

CREATE POLICY "School staff upload school-assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-assets' AND public.storage_school_folder(name) IS NOT NULL
    AND (public.is_super_admin(auth.uid()) OR public.is_school_staff(auth.uid(), public.storage_school_folder(name))));
CREATE POLICY "School admins update school-assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'school-assets' AND public.storage_school_folder(name) IS NOT NULL
    AND (public.is_super_admin(auth.uid()) OR public.can_manage_school(auth.uid(), public.storage_school_folder(name))))
  WITH CHECK (bucket_id = 'school-assets' AND public.storage_school_folder(name) IS NOT NULL
    AND (public.is_super_admin(auth.uid()) OR public.can_manage_school(auth.uid(), public.storage_school_folder(name))));
CREATE POLICY "School staff read school-assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'school-assets' AND public.storage_school_folder(name) IS NOT NULL
    AND (public.is_super_admin(auth.uid()) OR public.is_school_staff(auth.uid(), public.storage_school_folder(name))));