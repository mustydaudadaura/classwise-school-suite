export function verifyRegistrationReview(value: unknown, id: string, action: 'edit' | 'reject', changes: Record<string, unknown> = {}, previous = { active: false, pending_activation: true }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The saved review could not be confirmed');
  const row = value as Record<string, unknown>;
  if (row.id !== id) throw new Error('The registration review state could not be confirmed');
  if (action === 'reject') {
    if (row.active !== false || row.pending_activation !== false || !row.rejected_at || !row.rejection_reason) throw new Error('Rejection was not saved');
  } else {
    if (row.pending_activation !== previous.pending_activation || row.active !== previous.active) throw new Error('Editing must preserve the registration approval state');
    for (const [key, val] of Object.entries(changes)) if (row[key] !== val) throw new Error(`Saved ${key} does not match`);
  }
  return row;
}