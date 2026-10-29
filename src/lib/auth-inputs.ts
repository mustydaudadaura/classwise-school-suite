export function requireAuthInputs(url: string | undefined, key: string | undefined, header: string) {
  if (!url || !key) throw new Error('Sign-in service is not configured.');
  if (!header.startsWith('Bearer ')) throw new Error('Unauthorized: Please sign in to continue.');
  const token = header.slice(7).trim();
  if (!token) throw new Error('Unauthorized: Session token is missing.');
  return { url, key, token };
}