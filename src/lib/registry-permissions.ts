export function requireRegistryPermission(allowed: boolean): void {
  if (!allowed) throw new Error('Your account does not have permission to register records in this school. Ask the school administrator to check your access.');
}

export function admissionMode(canEditStudents: boolean, formClassIds: readonly string[], classId: string, teacherSubmission = false): 'direct' | 'form-master' | 'teacher' {
  if (canEditStudents && !teacherSubmission) return 'direct';
  if (teacherSubmission) {
    requireRegistryPermission(Boolean(classId));
    return 'teacher';
  }
  requireRegistryPermission(Boolean(classId) && formClassIds.includes(classId));
  return 'form-master';
}

export function classSubmissionState(isAdministrator: boolean, canSubmit: boolean, userId: string) {
  requireRegistryPermission(isAdministrator || canSubmit);
  return { active: isAdministrator, pending_activation: !isAdministrator, submitted_by: userId };
}