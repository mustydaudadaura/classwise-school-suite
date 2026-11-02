-- Phase 2: Hierarchical Role-Based Access Control (RBAC) & Role Inheritance Enforcement
-- Hierarchy:
--   Super Admin -> School Admin -> Class Form Master -> Class Subject Teacher
--   Isolated Portals: Student Portal (own records & published results), Parent Portal (registered children & published results)

CREATE OR REPLACE FUNCTION public.teaches_subject(
  _user_id uuid,
  _class_id uuid,
  _subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_allocations ta
    WHERE ta.teacher_id = _user_id
      AND ta.class_id = _class_id
      AND (ta.subject_id = _subject_id OR ta.is_class_teacher = true)
  )
$$;

GRANT EXECUTE ON FUNCTION public.teaches_subject(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_enter_subject_scores(
  _user_id uuid,
  _school_id uuid,
  _class_id uuid,
  _subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.school_module_enabled(_school_id, 'results')
    AND EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = _class_id
        AND c.school_id = _school_id
        AND c.active = true
        AND c.pending_activation = false
    )
    AND EXISTS (
      SELECT 1
      FROM public.subjects sub
      WHERE sub.id = _subject_id
        AND sub.school_id = _school_id
        AND sub.active = true
        AND sub.pending_activation = false
        AND (sub.class_id IS NULL OR sub.class_id = _class_id)
    )
    AND (
      -- 1. Super Admin inherits all capabilities across all schools
      public.is_super_admin(_user_id)
      -- 2. School Admin inherits Form Master and Subject Teacher capabilities within their school
      OR public.can_manage_school(_user_id, _school_id)
      -- 3. Class Form Master inherits Subject Teacher capabilities within their assigned class
      OR (
        public.has_role_in_school(_user_id, 'teacher', _school_id)
        AND public.is_form_master(_user_id, _class_id)
      )
      -- 4. Class Subject Teacher can enter/edit/submit scores strictly for their assigned (class_id, subject_id)
      OR (
        public.has_role_in_school(_user_id, 'teacher', _school_id)
        AND public.teaches_subject(_user_id, _class_id, _subject_id)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_enter_subject_scores(uuid, uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_review_class_results(
  _user_id uuid,
  _school_id uuid,
  _class_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR public.can_manage_school(_user_id, _school_id)
    OR (
      public.has_role_in_school(_user_id, 'teacher', _school_id)
      AND public.is_form_master(_user_id, _class_id)
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_review_class_results(uuid, uuid, uuid) TO authenticated;

-- Tighten teacher assessment write policies to enforce subject-level allocation (or Form Master / Admin inheritance)
DROP POLICY IF EXISTS "Teachers insert draft assessments" ON public.assessments;
CREATE POLICY "Teachers insert draft assessments" ON public.assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_enter_subject_scores(auth.uid(), school_id, class_id, subject_id)
    AND status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id
        AND st.school_id = school_id
        AND st.class_id = class_id
        AND st.active = true
        AND st.pending_activation = false
    )
  );

DROP POLICY IF EXISTS "Teachers update unapproved assessments" ON public.assessments;
CREATE POLICY "Teachers update unapproved assessments" ON public.assessments
  FOR UPDATE TO authenticated
  USING (
    public.can_enter_subject_scores(auth.uid(), school_id, class_id, subject_id)
    AND status <> 'approved'
  )
  WITH CHECK (
    public.can_enter_subject_scores(auth.uid(), school_id, class_id, subject_id)
    AND status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id
        AND st.school_id = school_id
        AND st.class_id = class_id
        AND st.active = true
        AND st.pending_activation = false
    )
  );

-- Enforce strict published-only report card access for Student and Parent portals
DROP POLICY IF EXISTS "Students and parents view published report cards" ON public.report_cards;
CREATE POLICY "Students and parents view published report cards" ON public.report_cards
  FOR SELECT TO authenticated
  USING (
    published = true
    AND (
      EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.id = report_cards.student_id
          AND st.user_id = auth.uid()
          AND st.active = true
          AND st.pending_activation = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.student_parents sp
        JOIN public.parents p ON p.id = sp.parent_id
        JOIN public.students st ON st.id = sp.student_id
        WHERE sp.student_id = report_cards.student_id
          AND p.user_id = auth.uid()
          AND st.active = true
          AND st.pending_activation = false
      )
    )
  );
