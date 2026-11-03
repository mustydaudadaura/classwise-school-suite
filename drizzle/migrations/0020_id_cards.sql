CREATE TABLE public.id_card_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  student_design jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff_design jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.id_card_settings TO authenticated;
GRANT ALL ON public.id_card_settings TO service_role;
ALTER TABLE public.id_card_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read id card design" ON public.id_card_settings FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins create id card design" ON public.id_card_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins change id card design" ON public.id_card_settings FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('student','staff')),
  holder_id uuid NOT NULL,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{10,16}$'),
  session text,
  revoked boolean NOT NULL DEFAULT false,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, kind, holder_id)
);
GRANT SELECT, INSERT, UPDATE ON public.id_cards TO authenticated;
GRANT ALL ON public.id_cards TO service_role;
ALTER TABLE public.id_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read id cards" ON public.id_cards FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins issue id cards" ON public.id_cards FOR INSERT TO authenticated
  WITH CHECK ((public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
    AND ((kind = 'student' AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = holder_id AND s.school_id = id_cards.school_id))
      OR (kind = 'staff' AND EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = holder_id AND sp.school_id = id_cards.school_id))));
CREATE POLICY "Admins update id cards" ON public.id_cards FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER id_cards_audit AFTER INSERT OR UPDATE ON public.id_cards FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();

-- Public QR verification: shows only what is printed on the card.
CREATE OR REPLACE FUNCTION public.verify_id_card(_code text)
 RETURNS TABLE(kind text, holder_name text, id_number text, detail text, school_name text, valid boolean, issued_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.kind,
    CASE WHEN c.kind = 'student' THEN concat_ws(' ', s.first_name, s.last_name) ELSE p.full_name END,
    CASE WHEN c.kind = 'student' THEN s.admission_no ELSE sp.staff_no END,
    CASE WHEN c.kind = 'student' THEN concat_ws(' ', cl.name, cl.arm) ELSE sp.department END,
    sc.name,
    (NOT c.revoked AND CASE WHEN c.kind = 'student' THEN coalesce(s.active, false) ELSE coalesce(sp.active, false) END),
    c.issued_at
  FROM public.id_cards c
  JOIN public.schools sc ON sc.id = c.school_id
  LEFT JOIN public.students s ON c.kind = 'student' AND s.id = c.holder_id
  LEFT JOIN public.classes cl ON cl.id = s.class_id
  LEFT JOIN public.staff_profiles sp ON c.kind = 'staff' AND sp.user_id = c.holder_id AND sp.school_id = c.school_id
  LEFT JOIN public.profiles p ON c.kind = 'staff' AND p.user_id = c.holder_id
  WHERE c.code = upper(_code)
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.verify_id_card(text) TO anon, authenticated;