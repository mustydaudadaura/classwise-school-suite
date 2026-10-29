export function scoreEntryClasses<T extends { id: string; teacher_id?: string | null }>(classes: T[], userId: string, administrator: boolean, allocations: { class_id: string; teacher_id: string }[]) {
  if (administrator) return classes;
  const assigned = new Set(allocations.filter(a => a.teacher_id === userId).map(a => a.class_id));
  return classes.filter(c => c.teacher_id === userId || assigned.has(c.id));
}