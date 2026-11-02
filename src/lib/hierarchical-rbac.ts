export type AlegacyHierarchyRole =
  | "super_admin"
  | "school_admin"
  | "form_master"
  | "teacher"
  | "accountant"
  | "student"
  | "parent";

export interface HierarchyActor {
  userId?: string | null;
  roles: readonly string[];
  schoolId?: string | null;
  /** Populated when the actor is a student portal user */
  studentId?: string | null;
  /** Populated when the actor is a parent portal user (registered children IDs) */
  linkedStudentIds?: readonly string[];
}

export interface ClassScopeRow {
  id: string;
  name?: string;
  school_id?: string | null;
  teacher_id?: string | null;
  level?: string | null;
  section?: string | null;
  arm?: string | null;
}

export interface SubjectScopeRow {
  id: string;
  name: string;
  class_id?: string | null;
  school_id?: string | null;
  code?: string | null;
}

export interface TeacherAllocationScopeRow {
  id?: string;
  school_id?: string | null;
  teacher_id: string;
  class_id: string;
  subject_id?: string | null;
  is_class_teacher?: boolean | null;
}

export interface StudentScopeRow {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  user_id?: string | null;
  active?: boolean | null;
  pending_activation?: boolean | null;
}

export interface ReportCardScopeRow {
  id: string;
  school_id?: string | null;
  student_id: string;
  class_id?: string | null;
  published?: boolean | null;
}

export interface SubjectSubmissionSummary {
  subjectId: string;
  subjectName: string;
  subjectTeachers: { id: string; name: string }[];
  totalStudents: number;
  enteredCount: number;
  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  missingCount: number;
  status: "approved" | "pending_review" | "incomplete" | "not_started";
}

export const ROLE_HIERARCHY_RANK: Record<AlegacyHierarchyRole, number> = {
  super_admin: 100,
  school_admin: 80,
  form_master: 60,
  teacher: 40,
  accountant: 40,
  parent: 10,
  student: 10,
};

/**
 * Resolves effective roles using the Alegacy role inheritance chain:
 * - Super Admin -> inherits School Admin, Form Master, Subject Teacher
 * - School Admin -> inherits Form Master, Subject Teacher (within their school)
 * - Form Master -> inherits Subject Teacher (within assigned classes)
 * - Student & Parent -> strictly isolated to their own portals
 */
export function resolveEffectiveRoles(
  assignedRoles: readonly string[],
  options?: {
    isFormMasterForClass?: boolean;
  }
): AlegacyHierarchyRole[] {
  const effective = new Set<AlegacyHierarchyRole>();

  for (const r of assignedRoles) {
    if (r in ROLE_HIERARCHY_RANK) {
      effective.add(r as AlegacyHierarchyRole);
    }
  }

  if (effective.has("super_admin")) {
    effective.add("school_admin");
    effective.add("form_master");
    effective.add("teacher");
  } else if (effective.has("school_admin")) {
    effective.add("form_master");
    effective.add("teacher");
  } else if (effective.has("form_master") || (effective.has("teacher") && options?.isFormMasterForClass)) {
    effective.add("form_master");
    effective.add("teacher");
  }

  return Array.from(effective);
}

export function isSuperAdminActor(actor: HierarchyActor): boolean {
  return actor.roles.includes("super_admin");
}

export function isSchoolAdminActor(actor: HierarchyActor, targetSchoolId?: string | null): boolean {
  if (isSuperAdminActor(actor)) return true;
  if (!actor.roles.includes("school_admin")) return false;
  if (targetSchoolId && actor.schoolId && actor.schoolId !== targetSchoolId) return false;
  return Boolean(actor.schoolId);
}

/**
 * Verifies whether an actor can access a given school's scope.
 * Super Admin can access every registered school.
 * All other roles are strictly restricted to their registered schoolId.
 */
export function canAccessSchoolScope(actor: HierarchyActor, targetSchoolId?: string | null): boolean {
  if (!targetSchoolId) return false;
  if (isSuperAdminActor(actor)) return true;
  return Boolean(actor.schoolId && actor.schoolId === targetSchoolId);
}

/**
 * Determines if the actor has Form Master authority (directly or via role inheritance)
 * for a specific class.
 * - Super Admin: true for all classes in all schools
 * - School Admin: true for all classes in their registered school
 * - Form Master: true ONLY for classes where classes.teacher_id === actor.userId
 *   or teacher_allocations has (class_id, teacher_id, is_class_teacher = true)
 */
export function isFormMasterForClass<
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  targetClassId: string,
  classes: readonly C[],
  allocations: readonly A[] = []
): boolean {
  if (!targetClassId) return false;
  const targetClass = classes.find((c) => c.id === targetClassId);
  if (!targetClass) return false;

  if (isSuperAdminActor(actor)) return true;
  if (targetClass.school_id && !canAccessSchoolScope(actor, targetClass.school_id)) {
    return false;
  }
  if (actor.roles.includes("school_admin")) return true;

  if (!actor.userId) return false;
  const isStaffTeacher = actor.roles.includes("form_master") || actor.roles.includes("teacher");
  if (!isStaffTeacher) return false;

  if (targetClass.teacher_id === actor.userId) return true;
  return allocations.some(
    (a) =>
      a.class_id === targetClassId &&
      a.teacher_id === actor.userId &&
      Boolean(a.is_class_teacher)
  );
}

/**
 * Returns the list of classes the actor is authorized to access.
 * - Super Admin: all classes in the selected school
 * - School Admin: all classes in their own school
 * - Class Form Master: their assigned classes (+ any additional classes where they teach a subject)
 * - Class Subject Teacher: only classes where they are allocated to teach a subject
 * - Student / Parent: none for staff operations
 */
export function getAuthorizedClasses<
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  classes: readonly C[],
  allocations: readonly A[] = []
): C[] {
  if (isSuperAdminActor(actor)) {
    return [...classes];
  }

  const schoolScopedClasses = classes.filter((c) =>
    c.school_id ? canAccessSchoolScope(actor, c.school_id) : Boolean(actor.schoolId)
  );

  if (actor.roles.includes("school_admin")) {
    return schoolScopedClasses;
  }

  const isStaffTeacher = actor.roles.includes("form_master") || actor.roles.includes("teacher");
  if (!isStaffTeacher || !actor.userId) {
    return [];
  }

  const formMasterMatches = schoolScopedClasses.filter((c) => c.teacher_id === actor.userId);
  const allocatedIds = new Set(
    allocations
      .filter((a) => a.teacher_id === actor.userId && (!a.school_id || a.school_id === actor.schoolId))
      .map((a) => a.class_id)
  );
  const allocatedMatches = schoolScopedClasses.filter((c) => allocatedIds.has(c.id));

  const seen = new Set<string>();
  const combined: C[] = [];
  // Form master classes come first (preserving priority order)
  for (const c of [...formMasterMatches, ...allocatedMatches]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      combined.push(c);
    }
  }
  return combined;
}

/**
 * Returns all subjects visible in a class for viewing/monitoring:
 * - Super Admin, School Admin, and the Class Form Master of `targetClassId` can view ALL subjects in the class.
 * - A Class Subject Teacher (who is NOT Form Master for `targetClassId`) can ONLY access their assigned subjects in `targetClassId`.
 */
export function getAuthorizedSubjectsForClass<
  S extends SubjectScopeRow,
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  targetClassId: string,
  subjects: readonly S[],
  classes: readonly C[],
  allocations: readonly A[] = []
): S[] {
  if (!targetClassId) return [];
  const authorizedClasses = getAuthorizedClasses(actor, classes, allocations);
  if (!authorizedClasses.some((c) => c.id === targetClassId)) {
    return [];
  }

  const classScopedSubjects = subjects.filter(
    (s) => (!s.class_id || s.class_id === targetClassId) && (!s.school_id || canAccessSchoolScope(actor, s.school_id))
  );

  // Super Admin, School Admin, and the assigned Class Form Master inherit full subject access in this class
  if (isFormMasterForClass(actor, targetClassId, classes, allocations)) {
    return classScopedSubjects;
  }

  // Class Subject Teacher: strictly restricted to their allocated subjects in this class
  if (!actor.userId || (!actor.roles.includes("teacher") && !actor.roles.includes("form_master"))) {
    return [];
  }

  const allocatedSubjectIds = new Set(
    allocations
      .filter(
        (a) =>
          a.teacher_id === actor.userId &&
          a.class_id === targetClassId &&
          Boolean(a.subject_id) &&
          (!a.school_id || canAccessSchoolScope(actor, a.school_id))
      )
      .map((a) => a.subject_id as string)
  );

  return classScopedSubjects.filter((s) => allocatedSubjectIds.has(s.id));
}

/**
 * Checks whether an actor can enter, edit, save, and submit scores for a specific (school, class, subject).
 * - Super Admin: true across all schools, classes, and subjects
 * - School Admin: true across all classes and subjects in their registered school
 * - Class Form Master: true for all subjects in their assigned classes (inherits Subject Teacher in assigned classes)
 * - Class Subject Teacher: true ONLY for their specifically allocated (class_id, subject_id)
 * - Student / Parent: false
 */
export function canEnterSubjectScore<
  S extends SubjectScopeRow,
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  targetSchoolId: string,
  targetClassId: string,
  targetSubjectId: string,
  classes: readonly C[],
  subjects: readonly S[],
  allocations: readonly A[] = []
): boolean {
  if (!targetSchoolId || !targetClassId || !targetSubjectId) return false;
  if (!canAccessSchoolScope(actor, targetSchoolId)) return false;

  const authorizedSubjects = getAuthorizedSubjectsForClass(
    actor,
    targetClassId,
    subjects,
    classes,
    allocations
  );
  return authorizedSubjects.some((s) => s.id === targetSubjectId);
}

/**
 * Checks whether an actor can monitor score submissions, view all subject teachers,
 * review class results, and identify pending submissions for a class.
 * Allowed for: Super Admin, School Admin (same school), and Class Form Master (assigned class).
 * Denied for: Subject Teacher (unassigned as Form Master to this class), Student, Parent.
 */
export function canMonitorAndReviewClassResults<
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  targetSchoolId: string,
  targetClassId: string,
  classes: readonly C[],
  allocations: readonly A[] = []
): boolean {
  if (!targetSchoolId || !targetClassId) return false;
  if (!canAccessSchoolScope(actor, targetSchoolId)) return false;
  return isFormMasterForClass(actor, targetClassId, classes, allocations);
}

/**
 * Checks whether an actor can approve final assessments or publish terminal report cards.
 * Allowed for: Super Admin and School Admin (within their registered school).
 */
export function canPublishSchoolResults(actor: HierarchyActor, targetSchoolId: string): boolean {
  if (!targetSchoolId) return false;
  if (isSuperAdminActor(actor)) return true;
  return isSchoolAdminActor(actor, targetSchoolId);
}

/**
 * Builds the Class Form Master / Admin score submission monitor table for an assigned class.
 */
export function buildClassSubmissionSummary(params: {
  classId: string;
  students: readonly { id: string }[];
  subjects: readonly SubjectScopeRow[];
  assessments: readonly { student_id: string; subject_id: string; status?: string | null }[];
  allocations: readonly TeacherAllocationScopeRow[];
  teachers?: readonly { id: string; name: string }[];
}): SubjectSubmissionSummary[] {
  const { classId, students, subjects, assessments, allocations, teachers = [] } = params;
  const studentIdSet = new Set(students.map((s) => s.id));
  const totalStudents = studentIdSet.size;
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

  const classSubjectsList = subjects.filter((s) => !s.class_id || s.class_id === classId);

  return classSubjectsList.map((subject) => {
    const subjectAllocs = allocations.filter(
      (a) => a.class_id === classId && a.subject_id === subject.id
    );
    const subjectTeachers = Array.from(new Set(subjectAllocs.map((a) => a.teacher_id))).map((tid) => ({
      id: tid,
      name: teacherMap.get(tid) ?? "Assigned Subject Teacher",
    }));

    const subjAssessments = assessments.filter(
      (a) => a.subject_id === subject.id && studentIdSet.has(a.student_id)
    );

    const enteredCount = subjAssessments.length;
    const draftCount = subjAssessments.filter((a) => a.status === "draft").length;
    const submittedCount = subjAssessments.filter((a) => a.status === "submitted").length;
    const approvedCount = subjAssessments.filter((a) => a.status === "approved").length;
    const missingCount = Math.max(0, totalStudents - enteredCount);

    let status: SubjectSubmissionSummary["status"] = "not_started";
    if (totalStudents > 0 && approvedCount === totalStudents) {
      status = "approved";
    } else if (enteredCount > 0 && missingCount === 0 && submittedCount + approvedCount === totalStudents) {
      status = "pending_review";
    } else if (enteredCount > 0) {
      status = "incomplete";
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      subjectTeachers,
      totalStudents,
      enteredCount,
      draftCount,
      submittedCount,
      approvedCount,
      missingCount,
      status,
    };
  });
}

/**
 * Protects student records against URL, ID, and API manipulation across all 6 hierarchy roles.
 */
export function canAccessStudentRecord<
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  student: StudentScopeRow | null | undefined,
  classes: readonly C[] = [],
  allocations: readonly A[] = []
): boolean {
  if (!student) return false;
  if (isSuperAdminActor(actor)) return true;

  // Staff roles check
  const isStaff =
    actor.roles.includes("school_admin") ||
    actor.roles.includes("form_master") ||
    actor.roles.includes("teacher") ||
    actor.roles.includes("accountant");

  if (isStaff) {
    if (student.school_id && !canAccessSchoolScope(actor, student.school_id)) {
      return false;
    }
    if (actor.roles.includes("school_admin") || actor.roles.includes("accountant")) {
      return true;
    }
    // Form Master & Subject Teacher: only students in their assigned/allocated classes
    if (!student.class_id) return false;
    const authorizedClasses = getAuthorizedClasses(actor, classes, allocations);
    return authorizedClasses.some((c) => c.id === student.class_id);
  }

  // Student Portal: strictly their own student record
  if (actor.roles.includes("student")) {
    if (actor.studentId && student.id === actor.studentId) return true;
    if (actor.userId && student.user_id && student.user_id === actor.userId) return true;
    return false;
  }

  // Parent Portal: strictly their registered children
  if (actor.roles.includes("parent")) {
    if (!actor.linkedStudentIds?.includes(student.id)) return false;
    if (actor.schoolId && student.school_id && actor.schoolId !== student.school_id) return false;
    return true;
  }

  return false;
}

/**
 * Protects report card records against URL, ID, and API manipulation.
 * Students and Parents can ONLY view published report cards belonging to themselves / their registered children.
 */
export function canAccessReportCardRecord<
  C extends ClassScopeRow,
  A extends TeacherAllocationScopeRow,
>(
  actor: HierarchyActor,
  reportCard: ReportCardScopeRow | null | undefined,
  classes: readonly C[] = [],
  allocations: readonly A[] = []
): boolean {
  if (!reportCard) return false;
  if (isSuperAdminActor(actor)) return true;

  const isStaff =
    actor.roles.includes("school_admin") ||
    actor.roles.includes("form_master") ||
    actor.roles.includes("teacher");

  if (isStaff) {
    if (reportCard.school_id && !canAccessSchoolScope(actor, reportCard.school_id)) {
      return false;
    }
    if (actor.roles.includes("school_admin")) {
      return true;
    }
    if (!reportCard.class_id) return false;
    const authorizedClasses = getAuthorizedClasses(actor, classes, allocations);
    return authorizedClasses.some((c) => c.id === reportCard.class_id);
  }

  // Student & Parent Portals: report card MUST be published
  if (!reportCard.published) {
    return false;
  }

  if (actor.roles.includes("student")) {
    return Boolean(actor.studentId && reportCard.student_id === actor.studentId);
  }

  if (actor.roles.includes("parent")) {
    if (!actor.linkedStudentIds?.includes(reportCard.student_id)) return false;
    if (actor.schoolId && reportCard.school_id && actor.schoolId !== reportCard.school_id) return false;
    return true;
  }

  return false;
}
