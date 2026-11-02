export type TeacherAllocationItem = {
  class_id: string;
  teacher_id: string;
  subject_id?: string | null;
  is_class_teacher?: boolean | null;
};

export function scoreEntryClasses<T extends { id: string; teacher_id?: string | null }>(
  classes: T[],
  userId: string,
  administrator: boolean,
  allocations: TeacherAllocationItem[],
) {
  if (administrator) return classes;
  const assigned = new Set(allocations.filter(a => a.teacher_id === userId).map(a => a.class_id));
  return classes.filter(c => c.teacher_id === userId || assigned.has(c.id));
}

export function isClassFormMaster<T extends { id: string; teacher_id?: string | null }>(
  classes: T[],
  classId: string,
  userId: string,
  administrator: boolean,
  allocations: TeacherAllocationItem[] = [],
): boolean {
  if (!classId) return false;
  if (administrator) return true;
  const target = classes.find(c => c.id === classId);
  if (!target) return false;
  if (target.teacher_id === userId) return true;
  return allocations.some(
    a => a.class_id === classId && a.teacher_id === userId && Boolean(a.is_class_teacher),
  );
}

export function scoreEntrySubjects<
  S extends { id: string; name: string; class_id?: string | null },
  C extends { id: string; teacher_id?: string | null },
>(
  subjects: S[],
  classes: C[],
  classId: string,
  userId: string,
  administrator: boolean,
  allocations: TeacherAllocationItem[] = [],
): S[] {
  if (!classId) return [];
  const allowedClasses = scoreEntryClasses(classes, userId, administrator, allocations);
  if (!allowedClasses.some(c => c.id === classId)) return [];

  const classScoped = subjects.filter(s => !s.class_id || s.class_id === classId);
  if (isClassFormMaster(classes, classId, userId, administrator, allocations)) {
    return classScoped;
  }

  const allocatedSubjectIds = new Set(
    allocations
      .filter(a => a.teacher_id === userId && a.class_id === classId && Boolean(a.subject_id))
      .map(a => a.subject_id as string),
  );
  return classScoped.filter(s => allocatedSubjectIds.has(s.id));
}