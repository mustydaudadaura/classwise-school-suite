ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS admission_no_start text;
CREATE OR REPLACE FUNCTION public.next_admission_number(_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _last text; _start text; _code text; _num text; _prefix text; _next text; _n bigint;
BEGIN
  IF NOT public.is_school_staff(auth.uid(), _school_id) AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT admission_no INTO _last FROM public.students
   WHERE school_id = _school_id AND admission_no ~ '[0-9]+$'
   ORDER BY created_at DESC LIMIT 1;
  IF _last IS NULL THEN
    SELECT NULLIF(trim(admission_no_start),''), COALESCE(NULLIF(code,''),'ADM') INTO _start, _code FROM public.schools WHERE id = _school_id;
    RETURN jsonb_build_object('last', NULL, 'next', COALESCE(_start, upper(_code) || '/' || to_char(now(),'YYYY') || '/0001'));
  END IF;
  _num := substring(_last from '([0-9]+)$');
  _prefix := left(_last, length(_last) - length(_num));
  _n := _num::bigint + 1;
  _next := _prefix || lpad(_n::text, length(_num), '0');
  WHILE EXISTS (SELECT 1 FROM public.students WHERE school_id=_school_id AND lower(admission_no)=lower(_next)) LOOP
    _n := _n + 1; _next := _prefix || lpad(_n::text, length(_num), '0');
  END LOOP;
  RETURN jsonb_build_object('last', _last, 'next', _next);
END $$;
REVOKE ALL ON FUNCTION public.next_admission_number(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_admission_number(uuid) TO authenticated;