import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SCHOOL_PERMISSIONS } from '@/lib/school-access';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
export function RegisteredDetailsEditor({ kind, id, name }: { kind: 'profile' | 'role'; id: string; name: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  async function load() {
    setOpen(true); setBusy(true); setLoaded(false);
    try {
      const response = kind === 'role' ? await supabase.from('school_custom_roles').select('school_id,name,permissions').eq('id', id).single() : await supabase.from('profiles').select('school_id,full_name,phone').eq('user_id', id).single();
      if (response.error) throw response.error;
      const row = response.data;
      const actor = (await supabase.auth.getUser()).data.user;
      if (!actor) throw new Error('Sign in to edit details');
      const check = await supabase.rpc('can_manage_school', { _user_id: actor.id, _school_id: row.school_id ?? '00000000-0000-0000-0000-000000000000' });
      if (check.error || !check.data) throw new Error('School administrator access required');
      setSid(row.school_id);
      if ('name' in row) { setLabel(row.name); setPermissions(row.permissions); }
      else { setLabel(row.full_name ?? ''); setPhone(row.phone ?? ''); }
      setLoaded(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load details'); setOpen(false); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || !loaded) return;
    setBusy(true);
    try {
      if (kind === 'role') {
        const { data, error } = await supabase.from('school_custom_roles').update({ name: label.trim(), permissions }).eq('id', id).eq('school_id', sid ?? '').select('name,permissions').single();
        if (error) throw error;
        if (data.name !== label.trim() || JSON.stringify(data.permissions.slice().sort()) !== JSON.stringify(permissions.slice().sort())) throw new Error('Saved role details could not be confirmed');
      } else {
        let request = supabase.from('profiles').update({ full_name: label.trim(), phone: phone.trim() || null }).eq('user_id', id);
        request = sid ? request.eq('school_id', sid) : request.is('school_id', null);
        const { data, error } = await request.select('full_name,phone').single();
        if (error) throw error;
        if (data.full_name !== label.trim() || data.phone !== (phone.trim() || null)) throw new Error('Saved staff details could not be confirmed');
      }
      await qc.invalidateQueries(); toast.success('Details saved'); setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Could not save details'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="ghost" size="icon" aria-label={`Edit ${name} details`} title={`Edit ${name} details`} onClick={load} disabled={busy}><Pencil className="size-4" /></Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Edit {kind === 'role' ? 'custom role' : 'staff details'}</DialogTitle></DialogHeader>
      {!loaded ? <p>Loading details…</p> : <form onSubmit={save} className="space-y-4"><div className="space-y-2"><Label htmlFor={`details-name-${id}`}>{kind === 'role' ? 'Role name' : 'Full name'}</Label><Input id={`details-name-${id}`} required minLength={kind === 'role' ? 2 : 1} maxLength={kind === 'role' ? 80 : 200} value={label} onChange={e => setLabel(e.target.value)} /></div>
      {kind === 'profile' ? <div className="space-y-2"><Label htmlFor={`details-phone-${id}`}>Phone</Label><Input id={`details-phone-${id}`} type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div> : <div className="grid gap-3 sm:grid-cols-2">{SCHOOL_PERMISSIONS.filter(p => !['settings.edit','users.edit','audit.view'].includes(p)).map(p => <label key={p} className="flex items-center gap-2 text-sm"><Checkbox checked={permissions.includes(p)} onCheckedChange={v => setPermissions(current => v ? [...current,p] : current.filter(key => key !== p))} />{p.replace('.', ' · ')}</label>)}</div>}
      <Button type="submit" disabled={busy || !label.trim() || (kind === 'role' && !permissions.length)}>{busy ? 'Saving…' : 'Save details'}</Button></form>}
    </DialogContent></Dialog>
  </>;
}
