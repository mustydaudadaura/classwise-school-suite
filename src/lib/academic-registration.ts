type ClassFields = { name: string; level: string; arm: string; section: string };
type SubjectFields = { name: string; code: string; class_id: string };
type ClassLink = { id: string; school_id: string; active: boolean; pending_activation?: boolean };

export function validateClassCreation(fields: ClassFields) {
  for (const field of ['name', 'level', 'arm', 'section'] as const) {
    if (!fields[field]?.trim()) throw new Error(`Enter the class ${field}`);
  }
  if (!['nursery', 'primary', 'secondary'].includes(fields.section)) throw new Error('Choose a valid class section');
  return { name: fields.name.trim(), level: fields.level.trim(), arm: fields.arm.trim(), section: fields.section as 'nursery' | 'primary' | 'secondary' };
}

export function validateSubjectCreation(fields: SubjectFields, schoolId: string, classes: ClassLink[]) {
  if (!fields.name.trim()) throw new Error('Enter a subject name');
  if (!fields.code.trim()) throw new Error('Enter a subject code');
  if (!classes.some(c => c.id === fields.class_id && c.school_id === schoolId && c.active && !c.pending_activation)) {
    throw new Error('Create and activate a class in this school before adding its subjects');
  }
  return { name: fields.name.trim(), code: fields.code.trim(), class_id: fields.class_id };
}