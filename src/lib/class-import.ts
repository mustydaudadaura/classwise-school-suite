import { validateClassCreation, validateSubjectCreation } from './academic-registration';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

const key = (value: string) => value.trim().toLocaleLowerCase();

export function prepareClassImport(names: string, schoolId: string, classes: Tables<'classes'>[], sourceId: string) {
  const source = classes.find(c => c.id === sourceId && c.school_id === schoolId && c.active && !c.pending_activation);
  if (!source) throw new Error('Choose an active source class in this school');
  const settings = validateClassCreation({ name: source.name, level: source.level ?? '', arm: source.arm ?? '', section: source.section ?? '' });
  const requested = [...new Map(names.split(/\r?\n/).map(n => n.trim()).filter(Boolean).map(n => [key(n), n])).values()];
  if (!requested.length) throw new Error('Enter at least one new class name');
  const existing = new Set(classes.filter(c => c.school_id === schoolId).map(c => key(c.name)));
  const rows: TablesInsert<'classes'>[] = requested.filter(n => !existing.has(key(n))).map(name => ({
    school_id: schoolId, ...settings, name,
  }));
  return { rows, skipped: requested.length - rows.length };
}

export function prepareSubjectCopy(schoolId: string, sourceId: string, targetIds: string[], classes: Tables<'classes'>[], subjects: Tables<'subjects'>[]) {
  const allowed = new Set(classes.filter(c => c.school_id === schoolId && c.active && !c.pending_activation).map(c => c.id));
  const targets = [...new Set(targetIds)];
  if (!allowed.has(sourceId) || !targets.length || targets.some(id => id === sourceId || !allowed.has(id))) {
    throw new Error('Choose a source and different active destination classes in this school');
  }
  const sourceSubjects = subjects.filter(s => s.school_id === schoolId && s.class_id === sourceId && s.active && !s.pending_activation);
  if (!sourceSubjects.length) throw new Error('The source class has no active subjects');
  const rows: TablesInsert<'subjects'>[] = [];
  let skipped = 0;
  for (const class_id of targets) {
    const existing = new Set(subjects.filter(s => s.school_id === schoolId && s.class_id === class_id).map(s => key(s.name)));
    for (const subject of sourceSubjects) {
      if (existing.has(key(subject.name))) { skipped++; continue; }
      existing.add(key(subject.name));
      rows.push({ school_id: schoolId, ...validateSubjectCreation({ class_id, name: subject.name, code: subject.code ?? '' }, schoolId, classes) });
    }
  }
  return { rows, skipped };
}

export function verifyImportedRows(rows: { id: string; school_id: string }[] | null, expected: number, schoolId: string) {
  if (!rows || rows.length !== expected || rows.some(row => !row.id || row.school_id !== schoolId)) {
    throw new Error('Not all imported records were confirmed. Reload the list before retrying.');
  }
}