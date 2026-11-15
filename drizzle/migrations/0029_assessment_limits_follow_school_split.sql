ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_ca1_check;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_ca2_check;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_exam_check;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_score_bounds;
ALTER TABLE public.assessments ADD CONSTRAINT assessments_score_bounds CHECK (
  COALESCE(ca1,0) BETWEEN 0 AND 30
  AND COALESCE(ca2,0) BETWEEN 0 AND 20
  AND COALESCE(exam,0) BETWEEN 0 AND 70
  AND COALESCE(ca1,0) + COALESCE(ca2,0) + COALESCE(exam,0) <= 100
);