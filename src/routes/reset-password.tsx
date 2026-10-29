import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPasswordRecoveryHash, validateResetPassword } from '@/lib/password-recovery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset your password — Alegacy' },
    { name: 'description', content: 'Securely choose a new password for your Alegacy school account.' },
    { property: 'og:title', content: 'Reset your password — Alegacy' },
    { property: 'og:description', content: 'Securely choose a new password for your Alegacy school account.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const recoveryHash = isPasswordRecoveryHash(window.location.hash);
    const hasCode = new URLSearchParams(window.location.search).has('code');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') setState('ready');
    });
    const check = async () => {
      // The auth client consumes hash/code credentials; getUser verifies the resulting session.
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if ((recoveryHash || hasCode) && data.user && !authError) setState('ready');
      else setState(current => current === 'ready' ? current : 'invalid');
    };
    void check();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || state !== 'ready') return;
    const validation = validateResetPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmation('');
      window.history.replaceState(null, '', '/reset-password');
      await supabase.auth.signOut();
      setState('done');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your password could not be updated. Request a fresh reset link and try again.');
    } finally { setSaving(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <section className="w-full max-w-md space-y-6">
      <Link to="/" className="text-xl font-bold text-primary">Alegacy</Link>
      <div className="space-y-2">
        <KeyRound className="h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">{state === 'done' ? 'Password updated' : 'Reset your password'}</h1>
      </div>
      {state === 'checking' && <p role="status" className="text-muted-foreground">Checking your reset link…</p>}
      {state === 'invalid' && <div className="space-y-4">
        <p role="alert" className="text-destructive">This reset link is missing, expired, or already used. Request a new link from the sign-in page.</p>
        <Button asChild><Link to="/auth">Back to sign in</Link></Button>
      </div>}
      {state === 'ready' && <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="w-full">{saving ? 'Updating…' : 'Save new password'}</Button>
      </form>}
      {state === 'done' && <div className="space-y-4"><p role="status" className="text-muted-foreground">Your new password is saved. Sign in with it to continue.</p><Button asChild><Link to="/auth">Sign in</Link></Button></div>}
    </section>
  </main>;
}