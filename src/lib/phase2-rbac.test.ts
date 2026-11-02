import { describe, it, expect } from "./test-compat";
import fs from "node:fs";
import path from "node:path";
import {
  resolveEffectiveRoles,
  canAccessSchoolScope,
  isFormMasterForClass,
  getAuthorizedClasses,
  getAuthorizedSubjectsForClass,
  canEnterSubjectScore,
  canMonitorAndReviewClassResults,
  canPublishSchoolResults,
  buildClassSubmissionSummary,
  canAccessStudentRecord,
  canAccessReportCardRecord,
  type HierarchyActor,
  type ClassScopeRow,
  type SubjectScopeRow,
  type TeacherAllocationScopeRow,
  type StudentScopeRow,
  type ReportCardScopeRow,
} from "./hierarchical-rbac";
import {
  scoreEntryClasses,
  scoreEntrySubjects,
  isClassFormMaster,
} from "./form-master";

// Test fixtures representing two distinct schools, multiple classes, subjects, teachers, students, and parents
const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
const SCHOOL_B = "22222222-2222-4222-8222-222222222222";

const CLASSES: ClassScopeRow[] = [
  { id: "cls-jss1a", name: "JSS 1A", school_id: SCHOOL_A, teacher_id: "usr-fm-jss1a" },
  { id: "cls-jss2b", name: "JSS 2B", school_id: SCHOOL_A, teacher_id: "usr-fm-jss2b" },
  { id: "cls-ss1a", name: "SS 1A", school_id: SCHOOL_A, teacher_id: null },
  { id: "cls-other-school", name: "JSS 1A (School B)", school_id: SCHOOL_B, teacher_id: "usr-fm-schoolb" },
];

const SUBJECTS: SubjectScopeRow[] = [
  { id: "sub-math-jss1a", name: "Mathematics", class_id: "cls-jss1a", school_id: SCHOOL_A },
  { id: "sub-eng-jss1a", name: "English Language", class_id: "cls-jss1a", school_id: SCHOOL_A },
  { id: "sub-sci-jss1a", name: "Basic Science", class_id: "cls-jss1a", school_id: SCHOOL_A },
  { id: "sub-math-jss2b", name: "Mathematics", class_id: "cls-jss2b", school_id: SCHOOL_A },
  { id: "sub-eng-jss2b", name: "English Language", class_id: "cls-jss2b", school_id: SCHOOL_A },
  { id: "sub-math-schoolb", name: "Mathematics", class_id: "cls-other-school", school_id: SCHOOL_B },
];

const ALLOCATIONS: TeacherAllocationScopeRow[] = [
  // Subject teacher 1 teaches ONLY Mathematics in JSS 1A and Mathematics in JSS 2B
  {
    id: "alloc-1",
    school_id: SCHOOL_A,
    teacher_id: "usr-sub-math",
    class_id: "cls-jss1a",
    subject_id: "sub-math-jss1a",
    is_class_teacher: false,
  },
  {
    id: "alloc-2",
    school_id: SCHOOL_A,
    teacher_id: "usr-sub-math",
    class_id: "cls-jss2b",
    subject_id: "sub-math-jss2b",
    is_class_teacher: false,
  },
  // Subject teacher 2 teaches ONLY English in JSS 1A
  {
    id: "alloc-3",
    school_id: SCHOOL_A,
    teacher_id: "usr-sub-eng",
    class_id: "cls-jss1a",
    subject_id: "sub-eng-jss1a",
    is_class_teacher: false,
  },
  // Form Master of JSS 1A also teaches English in JSS 2B as a Subject Teacher
  {
    id: "alloc-4",
    school_id: SCHOOL_A,
    teacher_id: "usr-fm-jss1a",
    class_id: "cls-jss2b",
    subject_id: "sub-eng-jss2b",
    is_class_teacher: false,
  },
];

const STUDENTS: StudentScopeRow[] = [
  { id: "stu-jss1a-1", school_id: SCHOOL_A, class_id: "cls-jss1a", user_id: "usr-student-1", active: true, pending_activation: false },
  { id: "stu-jss1a-2", school_id: SCHOOL_A, class_id: "cls-jss1a", user_id: "usr-student-2", active: true, pending_activation: false },
  { id: "stu-jss2b-1", school_id: SCHOOL_A, class_id: "cls-jss2b", user_id: "usr-student-3", active: true, pending_activation: false },
  { id: "stu-ss1a-1", school_id: SCHOOL_A, class_id: "cls-ss1a", user_id: "usr-student-4", active: true, pending_activation: false },
  { id: "stu-schoolb-1", school_id: SCHOOL_B, class_id: "cls-other-school", user_id: "usr-student-b1", active: true, pending_activation: false },
];

const REPORT_CARDS: ReportCardScopeRow[] = [
  { id: "rc-stu1-pub", school_id: SCHOOL_A, student_id: "stu-jss1a-1", class_id: "cls-jss1a", published: true },
  { id: "rc-stu1-draft", school_id: SCHOOL_A, student_id: "stu-jss1a-1", class_id: "cls-jss1a", published: false },
  { id: "rc-stu2-pub", school_id: SCHOOL_A, student_id: "stu-jss1a-2", class_id: "cls-jss1a", published: true },
  { id: "rc-stu3-pub", school_id: SCHOOL_A, student_id: "stu-jss2b-1", class_id: "cls-jss2b", published: true },
  { id: "rc-schoolb-pub", school_id: SCHOOL_B, student_id: "stu-schoolb-1", class_id: "cls-other-school", published: true },
];

// Actors for all 6 hierarchy levels
const SUPER_ADMIN: HierarchyActor = {
  userId: "usr-super-admin",
  roles: ["super_admin"],
  schoolId: SCHOOL_A,
};

const SCHOOL_ADMIN_A: HierarchyActor = {
  userId: "usr-school-admin-a",
  roles: ["school_admin"],
  schoolId: SCHOOL_A,
};

const FORM_MASTER_JSS1A: HierarchyActor = {
  userId: "usr-fm-jss1a",
  roles: ["teacher"],
  schoolId: SCHOOL_A,
};

const SUBJECT_TEACHER_MATH: HierarchyActor = {
  userId: "usr-sub-math",
  roles: ["teacher"],
  schoolId: SCHOOL_A,
};

const STUDENT_1: HierarchyActor = {
  userId: "usr-student-1",
  roles: ["student"],
  schoolId: SCHOOL_A,
  studentId: "stu-jss1a-1",
};

const PARENT_OF_STU1_AND_STU3: HierarchyActor = {
  userId: "usr-parent-1",
  roles: ["parent"],
  schoolId: SCHOOL_A,
  linkedStudentIds: ["stu-jss1a-1", "stu-jss2b-1"],
};

describe("Phase 2: Hierarchical RBAC & Role Inheritance", () => {
  it("resolves role inheritance down the administrative hierarchy while isolating Student and Parent portals", () => {
    const superEffective = resolveEffectiveRoles(["super_admin"]);
    expect(superEffective.includes("super_admin")).toBe(true);
    expect(superEffective.includes("school_admin")).toBe(true);
    expect(superEffective.includes("form_master")).toBe(true);
    expect(superEffective.includes("teacher")).toBe(true);

    const schoolAdminEffective = resolveEffectiveRoles(["school_admin"]);
    expect(schoolAdminEffective.includes("super_admin")).toBe(false);
    expect(schoolAdminEffective.includes("school_admin")).toBe(true);
    expect(schoolAdminEffective.includes("form_master")).toBe(true);
    expect(schoolAdminEffective.includes("teacher")).toBe(true);

    const formMasterEffective = resolveEffectiveRoles(["teacher"], { isFormMasterForClass: true });
    expect(formMasterEffective.includes("school_admin")).toBe(false);
    expect(formMasterEffective.includes("form_master")).toBe(true);
    expect(formMasterEffective.includes("teacher")).toBe(true);

    const subjectTeacherEffective = resolveEffectiveRoles(["teacher"], { isFormMasterForClass: false });
    expect(subjectTeacherEffective).toEqual(["teacher"]);

    const studentEffective = resolveEffectiveRoles(["student"]);
    expect(studentEffective).toEqual(["student"]);

    const parentEffective = resolveEffectiveRoles(["parent"]);
    expect(parentEffective).toEqual(["parent"]);
  });

  it("SUPER ADMIN: has full access to every registered school and inherits all School Admin, Form Master, and Subject Teacher capabilities", () => {
    expect(canAccessSchoolScope(SUPER_ADMIN, SCHOOL_A)).toBe(true);
    expect(canAccessSchoolScope(SUPER_ADMIN, SCHOOL_B)).toBe(true);

    const authorizedClasses = getAuthorizedClasses(SUPER_ADMIN, CLASSES, ALLOCATIONS);
    expect(authorizedClasses.length).toBe(4);

    // Can enter scores for any subject in School A and School B
    expect(
      canEnterSubjectScore(SUPER_ADMIN, SCHOOL_A, "cls-jss1a", "sub-sci-jss1a", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(true);
    expect(
      canEnterSubjectScore(SUPER_ADMIN, SCHOOL_B, "cls-other-school", "sub-math-schoolb", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(true);

    // Can monitor/review class submissions and publish results in any school
    expect(canMonitorAndReviewClassResults(SUPER_ADMIN, SCHOOL_A, "cls-jss1a", CLASSES, ALLOCATIONS)).toBe(true);
    expect(canMonitorAndReviewClassResults(SUPER_ADMIN, SCHOOL_B, "cls-other-school", CLASSES, ALLOCATIONS)).toBe(true);
    expect(canPublishSchoolResults(SUPER_ADMIN, SCHOOL_A)).toBe(true);
    expect(canPublishSchoolResults(SUPER_ADMIN, SCHOOL_B)).toBe(true);

    // Can access any student record and any report card (published or draft) across schools
    for (const st of STUDENTS) {
      expect(canAccessStudentRecord(SUPER_ADMIN, st, CLASSES, ALLOCATIONS)).toBe(true);
    }
    for (const rc of REPORT_CARDS) {
      expect(canAccessReportCardRecord(SUPER_ADMIN, rc, CLASSES, ALLOCATIONS)).toBe(true);
    }
  });

  it("SCHOOL ADMIN: has full administrative, Form Master, and Subject Teacher access within their school, but is blocked from other schools", () => {
    expect(canAccessSchoolScope(SCHOOL_ADMIN_A, SCHOOL_A)).toBe(true);
    expect(canAccessSchoolScope(SCHOOL_ADMIN_A, SCHOOL_B)).toBe(false);

    const authorizedClasses = getAuthorizedClasses(SCHOOL_ADMIN_A, CLASSES, ALLOCATIONS);
    expect(authorizedClasses.map((c) => c.id)).toEqual(["cls-jss1a", "cls-jss2b", "cls-ss1a"]);

    // Inherits Form Master & Subject Teacher capabilities for all classes & subjects in School A
    expect(isFormMasterForClass(SCHOOL_ADMIN_A, "cls-jss1a", CLASSES, ALLOCATIONS)).toBe(true);
    expect(isFormMasterForClass(SCHOOL_ADMIN_A, "cls-ss1a", CLASSES, ALLOCATIONS)).toBe(true);
    expect(
      canEnterSubjectScore(SCHOOL_ADMIN_A, SCHOOL_A, "cls-jss1a", "sub-sci-jss1a", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(true);
    expect(canPublishSchoolResults(SCHOOL_ADMIN_A, SCHOOL_A)).toBe(true);

    // Blocked from School B via URL/ID/API manipulation
    expect(isFormMasterForClass(SCHOOL_ADMIN_A, "cls-other-school", CLASSES, ALLOCATIONS)).toBe(false);
    expect(
      canEnterSubjectScore(SCHOOL_ADMIN_A, SCHOOL_B, "cls-other-school", "sub-math-schoolb", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(false);
    expect(canPublishSchoolResults(SCHOOL_ADMIN_A, SCHOOL_B)).toBe(false);
    expect(canAccessStudentRecord(SCHOOL_ADMIN_A, STUDENTS[4], CLASSES, ALLOCATIONS)).toBe(false);
    expect(canAccessReportCardRecord(SCHOOL_ADMIN_A, REPORT_CARDS[4], CLASSES, ALLOCATIONS)).toBe(false);
  });

  it("CLASS FORM MASTER: has full visibility, submission monitoring, and inherited Subject Teacher access in assigned class, and is restricted from unassigned classes", () => {
    // Form Master of JSS 1A (who also teaches English in JSS 2B)
    expect(isFormMasterForClass(FORM_MASTER_JSS1A, "cls-jss1a", CLASSES, ALLOCATIONS)).toBe(true);
    expect(isFormMasterForClass(FORM_MASTER_JSS1A, "cls-jss2b", CLASSES, ALLOCATIONS)).toBe(false);
    expect(isFormMasterForClass(FORM_MASTER_JSS1A, "cls-ss1a", CLASSES, ALLOCATIONS)).toBe(false);

    // Can monitor and review submissions in JSS 1A (their assigned Form Master class)
    expect(canMonitorAndReviewClassResults(FORM_MASTER_JSS1A, SCHOOL_A, "cls-jss1a", CLASSES, ALLOCATIONS)).toBe(true);
    // Cannot monitor/review JSS 2B where they are only a Subject Teacher
    expect(canMonitorAndReviewClassResults(FORM_MASTER_JSS1A, SCHOOL_A, "cls-jss2b", CLASSES, ALLOCATIONS)).toBe(false);

    // Inherits Subject Teacher capabilities for ALL subjects in JSS 1A
    const jss1aSubjects = getAuthorizedSubjectsForClass(
      FORM_MASTER_JSS1A,
      "cls-jss1a",
      SUBJECTS,
      CLASSES,
      ALLOCATIONS
    );
    expect(jss1aSubjects.map((s) => s.id)).toEqual([
      "sub-math-jss1a",
      "sub-eng-jss1a",
      "sub-sci-jss1a",
    ]);

    // In JSS 2B (where they are only allocated to English), they can ONLY access English, NOT Mathematics
    const jss2bSubjects = getAuthorizedSubjectsForClass(
      FORM_MASTER_JSS1A,
      "cls-jss2b",
      SUBJECTS,
      CLASSES,
      ALLOCATIONS
    );
    expect(jss2bSubjects.map((s) => s.id)).toEqual(["sub-eng-jss2b"]);
    expect(
      canEnterSubjectScore(FORM_MASTER_JSS1A, SCHOOL_A, "cls-jss2b", "sub-math-jss2b", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(false);

    // Cannot access students in SS 1A (unassigned class) or School B
    expect(canAccessStudentRecord(FORM_MASTER_JSS1A, STUDENTS[0], CLASSES, ALLOCATIONS)).toBe(true); // JSS 1A
    expect(canAccessStudentRecord(FORM_MASTER_JSS1A, STUDENTS[3], CLASSES, ALLOCATIONS)).toBe(false); // SS 1A
    expect(canAccessStudentRecord(FORM_MASTER_JSS1A, STUDENTS[4], CLASSES, ALLOCATIONS)).toBe(false); // School B
  });

  it("CLASS FORM MASTER: accurately monitors score submissions and identifies pending/missing submissions across class subjects", () => {
    const jss1aStudents = STUDENTS.filter((s) => s.class_id === "cls-jss1a");
    const summary = buildClassSubmissionSummary({
      classId: "cls-jss1a",
      students: jss1aStudents,
      subjects: SUBJECTS,
      assessments: [
        // Mathematics: both students submitted
        { student_id: "stu-jss1a-1", subject_id: "sub-math-jss1a", status: "submitted" },
        { student_id: "stu-jss1a-2", subject_id: "sub-math-jss1a", status: "submitted" },
        // English: only 1 student entered, 1 missing
        { student_id: "stu-jss1a-1", subject_id: "sub-eng-jss1a", status: "draft" },
        // Basic Science: 0 entered
      ],
      allocations: ALLOCATIONS,
      teachers: [
        { id: "usr-sub-math", name: "Mallam Musa (Math)" },
        { id: "usr-sub-eng", name: "Mrs. Adeyemi (English)" },
      ],
    });

    expect(summary.length).toBe(3);
    const mathRow = summary.find((s) => s.subjectId === "sub-math-jss1a")!;
    expect(mathRow.subjectTeachers.map((t) => t.name)).toEqual(["Mallam Musa (Math)"]);
    expect(mathRow.enteredCount).toBe(2);
    expect(mathRow.missingCount).toBe(0);
    expect(mathRow.status).toBe("pending_review");

    const engRow = summary.find((s) => s.subjectId === "sub-eng-jss1a")!;
    expect(engRow.enteredCount).toBe(1);
    expect(engRow.missingCount).toBe(1);
    expect(engRow.status).toBe("incomplete");

    const sciRow = summary.find((s) => s.subjectId === "sub-sci-jss1a")!;
    expect(sciRow.enteredCount).toBe(0);
    expect(sciRow.missingCount).toBe(2);
    expect(sciRow.status).toBe("not_started");
  });

  it("CLASS SUBJECT TEACHER: can only access assigned classes and assigned subjects, and cannot modify other teachers' subjects or scores", () => {
    // Math teacher is allocated to Mathematics in JSS 1A and JSS 2B, not SS 1A
    const classesForMathTeacher = scoreEntryClasses(CLASSES, "usr-sub-math", false, ALLOCATIONS);
    expect(classesForMathTeacher.map((c) => c.id)).toEqual(["cls-jss1a", "cls-jss2b"]);

    // In JSS 1A, Math teacher can ONLY see and enter scores for Mathematics, NOT English or Basic Science
    const subjectsForMathTeacher = scoreEntrySubjects(
      SUBJECTS.filter((s) => s.class_id === "cls-jss1a"),
      CLASSES,
      "cls-jss1a",
      "usr-sub-math",
      false,
      ALLOCATIONS
    );
    expect(subjectsForMathTeacher.map((s) => s.id)).toEqual(["sub-math-jss1a"]);

    expect(
      canEnterSubjectScore(
        SUBJECT_TEACHER_MATH,
        SCHOOL_A,
        "cls-jss1a",
        "sub-math-jss1a",
        CLASSES,
        SUBJECTS,
        ALLOCATIONS
      )
    ).toBe(true);

    // Blocked from modifying English or Basic Science in the same class
    expect(
      canEnterSubjectScore(
        SUBJECT_TEACHER_MATH,
        SCHOOL_A,
        "cls-jss1a",
        "sub-eng-jss1a",
        CLASSES,
        SUBJECTS,
        ALLOCATIONS
      )
    ).toBe(false);
    expect(
      canEnterSubjectScore(
        SUBJECT_TEACHER_MATH,
        SCHOOL_A,
        "cls-jss1a",
        "sub-sci-jss1a",
        CLASSES,
        SUBJECTS,
        ALLOCATIONS
      )
    ).toBe(false);

    // Blocked from Form Master review and school publishing
    expect(canMonitorAndReviewClassResults(SUBJECT_TEACHER_MATH, SCHOOL_A, "cls-jss1a", CLASSES, ALLOCATIONS)).toBe(false);
    expect(canPublishSchoolResults(SUBJECT_TEACHER_MATH, SCHOOL_A)).toBe(false);
  });

  it("STUDENT PORTAL: can access only their own academic information and published results, blocking URL/ID manipulation", () => {
    // Own student record allowed
    expect(canAccessStudentRecord(STUDENT_1, STUDENTS[0], CLASSES, ALLOCATIONS)).toBe(true);
    // Classmate's student record blocked
    expect(canAccessStudentRecord(STUDENT_1, STUDENTS[1], CLASSES, ALLOCATIONS)).toBe(false);
    // Other class/school student records blocked
    expect(canAccessStudentRecord(STUDENT_1, STUDENTS[2], CLASSES, ALLOCATIONS)).toBe(false);
    expect(canAccessStudentRecord(STUDENT_1, STUDENTS[4], CLASSES, ALLOCATIONS)).toBe(false);

    // Own PUBLISHED report card allowed
    expect(canAccessReportCardRecord(STUDENT_1, REPORT_CARDS[0], CLASSES, ALLOCATIONS)).toBe(true);
    // Own UNPUBLISHED (draft) report card blocked
    expect(canAccessReportCardRecord(STUDENT_1, REPORT_CARDS[1], CLASSES, ALLOCATIONS)).toBe(false);
    // Classmate's published report card blocked
    expect(canAccessReportCardRecord(STUDENT_1, REPORT_CARDS[2], CLASSES, ALLOCATIONS)).toBe(false);
    // Cannot enter scores or review classes
    expect(
      canEnterSubjectScore(STUDENT_1, SCHOOL_A, "cls-jss1a", "sub-math-jss1a", CLASSES, SUBJECTS, ALLOCATIONS)
    ).toBe(false);
  });

  it("PARENT PORTAL: can access only their registered children and their published results, blocking unlinked student IDs", () => {
    // Linked children (stu-jss1a-1 and stu-jss2b-1) allowed
    expect(canAccessStudentRecord(PARENT_OF_STU1_AND_STU3, STUDENTS[0], CLASSES, ALLOCATIONS)).toBe(true);
    expect(canAccessStudentRecord(PARENT_OF_STU1_AND_STU3, STUDENTS[2], CLASSES, ALLOCATIONS)).toBe(true);

    // Unlinked students in same class or other school blocked
    expect(canAccessStudentRecord(PARENT_OF_STU1_AND_STU3, STUDENTS[1], CLASSES, ALLOCATIONS)).toBe(false);
    expect(canAccessStudentRecord(PARENT_OF_STU1_AND_STU3, STUDENTS[3], CLASSES, ALLOCATIONS)).toBe(false);
    expect(canAccessStudentRecord(PARENT_OF_STU1_AND_STU3, STUDENTS[4], CLASSES, ALLOCATIONS)).toBe(false);

    // Published report cards of linked children allowed
    expect(canAccessReportCardRecord(PARENT_OF_STU1_AND_STU3, REPORT_CARDS[0], CLASSES, ALLOCATIONS)).toBe(true);
    expect(canAccessReportCardRecord(PARENT_OF_STU1_AND_STU3, REPORT_CARDS[3], CLASSES, ALLOCATIONS)).toBe(true);

    // Unpublished report card of linked child blocked
    expect(canAccessReportCardRecord(PARENT_OF_STU1_AND_STU3, REPORT_CARDS[1], CLASSES, ALLOCATIONS)).toBe(false);

    // Published report card of unlinked child blocked
    expect(canAccessReportCardRecord(PARENT_OF_STU1_AND_STU3, REPORT_CARDS[2], CLASSES, ALLOCATIONS)).toBe(false);
    expect(canAccessReportCardRecord(PARENT_OF_STU1_AND_STU3, REPORT_CARDS[4], CLASSES, ALLOCATIONS)).toBe(false);
  });

  it("verifies database migration 0017 enforces subject-level teacher RLS, Form Master inheritance, and published-only portal policies", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle/migrations/0017_hierarchical_rbac_enforcement.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql.includes("CREATE OR REPLACE FUNCTION public.teaches_subject")).toBe(true);
    expect(sql.includes("CREATE OR REPLACE FUNCTION public.can_enter_subject_scores")).toBe(true);
    expect(sql.includes("CREATE OR REPLACE FUNCTION public.can_review_class_results")).toBe(true);
    expect(sql.includes("public.can_enter_subject_scores(auth.uid(), school_id, class_id, subject_id)")).toBe(true);
    expect(sql.includes('CREATE POLICY "Students and parents view published report cards"')).toBe(true);
  });
});
