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
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') NOT IN ('classic_comprehensive','premier_standard','modern_executive','ubec_basic','islamic_integrated','waec_senior','islamiyya_arabic','islamiyya_hausa','islamiyya_arabic_hausa') THEN RAISE EXCEPTION 'Invalid report layout'; END IF;
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