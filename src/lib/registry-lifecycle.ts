export function protectRoleRemoval(callerId: string, targetId: string, role: string) {
  if (callerId === targetId || role === 'super_admin') throw new Error('Your own access and Super Admin roles are protected.');
}