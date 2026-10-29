export function requireSavedRecord<T extends { id: string; school_id: string }>(
  row: T | null,
  schoolId: string,
): T {
  if (!row?.id || row.school_id !== schoolId) {
    throw new Error('The record was not saved in the selected school. Please retry.');
  }
  return row;
}