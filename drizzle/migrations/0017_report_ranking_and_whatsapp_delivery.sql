CREATE OR REPLACE FUNCTION public.validate_report_template()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE k text; v jsonb; r jsonb; palette text[] := ARRAY['emerald','forest','green','lime','olive','teal','turquoise','cyan','sky','blue','navy','indigo','violet','purple','plum','magenta','pink','rose','red','crimson','orange','amber','gold','brown','slate','charcoal'];
BEGIN
 IF jsonb_typeof(NEW.report_template) <> 'object' THEN RAISE EXCEPTION 'Invalid report template'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.report_template) LOOP
  IF k='positions' THEN
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') NOT IN ('none','class','subject','both') THEN RAISE EXCEPTION 'Invalid position setting'; END IF;
  ELSIF k IN ('border','heading','table','rows','biodata','development','comments') THEN
   IF jsonb_typeof(v)<>'string' OR NOT ((v#>>'{}')=ANY(palette)) THEN RAISE EXCEPTION 'Invalid report colour'; END IF;
  ELSIF k='layout_id' THEN
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') NOT IN ('classic_comprehensive','premier_standard','modern_executive','ubec_basic','islamic_integrated','waec_senior','islamiyya_arabic') THEN RAISE EXCEPTION 'Invalid report layout'; END IF;
  ELSIF k IN ('arabic_school_name','arabic_address') THEN
   IF jsonb_typeof(v)<>'string' OR length(v#>>'{}') > 500 THEN RAISE EXCEPTION 'Invalid Arabic report identity'; END IF;
  ELSIF k='ranking_method' THEN
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') NOT IN ('total','average','ranges') THEN RAISE EXCEPTION 'Invalid ranking method'; END IF;
  ELSIF k='ranking_ranges' THEN
   IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v) > 50 THEN RAISE EXCEPTION 'Invalid ranking ranges'; END IF;
   FOR r IN SELECT * FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(r->'min')<>'number' OR jsonb_typeof(r->'max')<>'number' OR jsonb_typeof(r->'position')<>'number'
       OR (r->>'min')::numeric < 0 OR (r->>'max')::numeric > 100 OR (r->>'min')::numeric > (r->>'max')::numeric OR (r->>'position')::numeric < 1 THEN
     RAISE EXCEPTION 'Invalid ranking range';
    END IF;
   END LOOP;
  ELSE RAISE EXCEPTION 'Unknown report setting'; END IF;
 END LOOP;
 RETURN NEW;
END $function$;

CREATE TABLE public.report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  report_card_id uuid NOT NULL UNIQUE REFERENCES public.report_cards(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  phone text,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','invalid_number','confirmed')),
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.report_deliveries TO authenticated;
GRANT ALL ON public.report_deliveries TO service_role;
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read report deliveries" ON public.report_deliveries FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Staff record report deliveries" ON public.report_deliveries FOR INSERT TO authenticated
  WITH CHECK ((public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
    AND EXISTS (SELECT 1 FROM public.report_cards rc WHERE rc.id = report_card_id AND rc.student_id = report_deliveries.student_id AND rc.school_id = report_deliveries.school_id));
CREATE POLICY "Staff update report deliveries" ON public.report_deliveries FOR UPDATE TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.is_school_staff(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
    AND EXISTS (SELECT 1 FROM public.report_cards rc WHERE rc.id = report_card_id AND rc.student_id = report_deliveries.student_id AND rc.school_id = report_deliveries.school_id));

CREATE OR REPLACE FUNCTION public.guard_report_delivery()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
     AND NOT (public.can_manage_school(auth.uid(), NEW.school_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only school administrators can confirm delivery';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_report_delivery() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_report_delivery BEFORE INSERT OR UPDATE ON public.report_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_report_delivery();