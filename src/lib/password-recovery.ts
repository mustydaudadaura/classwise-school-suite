export function isPasswordRecoveryHash(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery';
}

export function validateResetPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for your new password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}