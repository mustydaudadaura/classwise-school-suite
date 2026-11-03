CREATE TABLE public.scratch_card_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  access_mode text NOT NULL DEFAULT 'free' CHECK (access_mode IN ('free','scratch')),
  price numeric NOT NULL DEFAULT 500 CHECK (price >= 0),
  max_views integer NOT NULL DEFAULT 3 CHECK (max_views BETWEEN 1 AND 1000),
  validity_days integer NOT NULL DEFAULT 90 CHECK (validity_days BETWEEN 1 AND 3650),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.scratch_card_settings TO authenticated;
GRANT ALL ON public.scratch_card_settings TO service_role;
ALTER TABLE public.scratch_card_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read scratch settings" ON public.scratch_card_settings FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins create scratch settings" ON public.scratch_card_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins change scratch settings" ON public.scratch_card_settings FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.scratch_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  serial_no text NOT NULL UNIQUE,
  pin_hash text NOT NULL UNIQUE,
  price numeric NOT NULL CHECK (price >= 0),
  max_views integer NOT NULL CHECK (max_views >= 1),
  views_used integer NOT NULL DEFAULT 0 CHECK (views_used >= 0),
  valid_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'unsold' CHECK (status IN ('unsold','sold','void')),
  sold_at timestamptz,
  sold_note text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (views_used <= max_views)
);
CREATE INDEX scratch_cards_school_idx ON public.scratch_cards(school_id, created_at DESC);
GRANT SELECT, UPDATE ON public.scratch_cards TO authenticated;
GRANT ALL ON public.scratch_cards TO service_role;
ALTER TABLE public.scratch_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scratch cards" ON public.scratch_cards FOR SELECT TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins mark scratch cards" ON public.scratch_cards FOR UPDATE TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

-- Admins may only change sale status / void; usage, PIN and limits stay fixed once generated.
CREATE OR REPLACE FUNCTION public.guard_scratch_card()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND (
     NEW.pin_hash IS DISTINCT FROM OLD.pin_hash OR NEW.serial_no IS DISTINCT FROM OLD.serial_no OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.price IS DISTINCT FROM OLD.price OR NEW.max_views IS DISTINCT FROM OLD.max_views OR NEW.views_used IS DISTINCT FROM OLD.views_used
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.first_used_at IS DISTINCT FROM OLD.first_used_at OR NEW.last_used_at IS DISTINCT FROM OLD.last_used_at) THEN
    RAISE EXCEPTION 'Only the sale status of a scratch card can be changed';
  END IF;
  IF OLD.status = 'void' AND NEW.status <> 'void' THEN RAISE EXCEPTION 'A voided card cannot be reactivated'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_scratch_card() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_scratch_card BEFORE UPDATE ON public.scratch_cards FOR EACH ROW EXECUTE FUNCTION public.guard_scratch_card();

CREATE TABLE public.scratch_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.scratch_cards(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report_card_id uuid REFERENCES public.report_cards(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  views_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scratch_card_redemptions TO authenticated;
GRANT ALL ON public.scratch_card_redemptions TO service_role;
ALTER TABLE public.scratch_card_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read redemptions" ON public.scratch_card_redemptions FOR SELECT TO authenticated
  USING (public.can_manage_school(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER immutable_scratch_redemptions BEFORE UPDATE OR DELETE ON public.scratch_card_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.immutable_school_audit();

CREATE TRIGGER scratch_card_settings_audit AFTER INSERT OR UPDATE ON public.scratch_card_settings
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER scratch_cards_audit AFTER UPDATE ON public.scratch_cards
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();

-- Atomic redemption: one row update per view, so the same card cannot be over-used concurrently.
CREATE OR REPLACE FUNCTION public.redeem_scratch_card(_school_id uuid, _pin_hash text, _student_id uuid, _report_card_id uuid, _parent_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c public.scratch_cards; r record;
BEGIN
  UPDATE public.scratch_cards SET views_used = views_used + 1,
    student_id = COALESCE(student_id, _student_id),
    first_used_at = COALESCE(first_used_at, now()), last_used_at = now()
  WHERE school_id = _school_id AND pin_hash = _pin_hash AND status <> 'void'
    AND views_used < max_views AND valid_until > now()
    AND (student_id IS NULL OR student_id = _student_id)
  RETURNING * INTO c;
  IF c.id IS NULL THEN
    SELECT status, views_used, max_views, valid_until, student_id INTO r FROM public.scratch_cards WHERE school_id = _school_id AND pin_hash = _pin_hash;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
    IF r.status = 'void' THEN RETURN jsonb_build_object('ok', false, 'reason', 'void'); END IF;
    IF r.valid_until <= now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
    IF r.views_used >= r.max_views THEN RETURN jsonb_build_object('ok', false, 'reason', 'exhausted'); END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'other_student');
  END IF;
  INSERT INTO public.scratch_card_redemptions(school_id, card_id, student_id, report_card_id, parent_id, views_after)
  VALUES (_school_id, c.id, _student_id, _report_card_id, _parent_id, c.views_used);
  RETURN jsonb_build_object('ok', true, 'remaining', c.max_views - c.views_used, 'valid_until', c.valid_until, 'serial_no', c.serial_no);
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_scratch_card(uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_scratch_card(uuid, text, uuid, uuid, uuid) TO service_role;