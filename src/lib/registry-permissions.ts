export function requireRegistryPermission(allowed: boolean): void {
  if (!allowed) throw new Error('Your account does not have permission to register records in this school. Ask the school administrator to check your access.');
}

export function admissionMode(canEditStudents: boolean, formClassIds: readonly string[], classId: string): 'direct' | 'form-master' {
  if (canEditStudents) return 'direct';
  requireRegistryPermission(Boolean(classId) && formClassIds.includes(classId));
  return 'form-master';
}