import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Pencil, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SCHOOL_PERMISSIONS } from '@/lib/school-access';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PassportPhotoStudioModal } from '@/components/admissions/PassportPhotoStudioModal';

export function RegisteredDetailsEditor({
  kind,
  id,
  name,
  schoolId: explicitSchoolId,
}: {
  kind: 'profile' | 'role';
  id: string;
  name: string;
  schoolId?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [staffNo, setStaffNo] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('teaching');
  const [hasStaffProfile, setHasStaffProfile] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  async function load() {
    setOpen(true);
    setBusy(true);
    setLoaded(false);
    try {
      const response =
        kind === 'role'
          ? await supabase.from('school_custom_roles').select('school_id,name,permissions').eq('id', id).single()
          : await supabase.from('profiles').select('school_id,full_name,phone,avatar_url').eq('user_id', id).single();
      if (response.error) throw response.error;
      const row = response.data;
      const actor = (await supabase.auth.getUser()).data.user;
      if (!actor) throw new Error('Sign in to edit details');
      const targetSchoolId = row.school_id ?? explicitSchoolId ?? null;
      const check = await supabase.rpc('can_manage_school', {
        _user_id: actor.id,
        _school_id: targetSchoolId ?? '00000000-0000-0000-0000-000000000000',
      });
      if (check.error || !check.data) throw new Error('School administrator access required');
      setSid(row.school_id);
      if ('name' in row) {
        setLabel(row.name);
        setPermissions(row.permissions);
      } else {
        setLabel(row.full_name ?? '');
        setPhone(row.phone ?? '');
        setAvatarUrl(row.avatar_url ?? '');
        const staffSchoolId = row.school_id ?? explicitSchoolId ?? null;
        if (staffSchoolId) {
          const sp = await supabase
            .from('staff_profiles')
            .select('staff_no,department,category,photo_url')
            .eq('user_id', id)
            .eq('school_id', staffSchoolId)
            .maybeSingle();
          if (sp.data) {
            setHasStaffProfile(true);
            setStaffNo(sp.data.staff_no ?? '');
            setDepartment(sp.data.department ?? '');
            setCategory(sp.data.category ?? 'teaching');
            if (sp.data.photo_url && !row.avatar_url) {
              setAvatarUrl(sp.data.photo_url);
            }
          } else {
            setHasStaffProfile(false);
            setStaffNo('');
            setDepartment('');
            setCategory('teaching');
          }
        }
      }
      setLoaded(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load details');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !loaded) return;
    setBusy(true);
    try {
      if (kind === 'role') {
        const { data, error } = await supabase
          .from('school_custom_roles')
          .update({ name: label.trim(), permissions })
          .eq('id', id)
          .eq('school_id', sid ?? '')
          .select('name,permissions')
          .single();
        if (error) throw error;
        if (
          data.name !== label.trim() ||
          JSON.stringify(data.permissions.slice().sort()) !== JSON.stringify(permissions.slice().sort())
        ) {
          throw new Error('Saved role details could not be confirmed');
        }
      } else {
        let request = supabase
          .from('profiles')
          .update({
            full_name: label.trim(),
            phone: phone.trim() || null,
            avatar_url: avatarUrl.trim() || null,
          })
          .eq('user_id', id);
        request = sid ? request.eq('school_id', sid) : request.is('school_id', null);
        const { data, error } = await request.select('full_name,phone').single();
        if (error) throw error;
        if (data.full_name !== label.trim() || data.phone !== (phone.trim() || null)) {
          throw new Error('Saved staff details could not be confirmed');
        }

        const staffSchoolId = sid ?? explicitSchoolId ?? null;
        if (staffSchoolId) {
          const staffPayload = {
            staff_no: staffNo.trim() || null,
            department: department.trim() || null,
            category: category || 'teaching',
            photo_url: avatarUrl.trim() || null,
          };
          if (hasStaffProfile) {
            await supabase
              .from('staff_profiles')
              .update(staffPayload)
              .eq('user_id', id)
              .eq('school_id', staffSchoolId);
          } else if (staffNo.trim() || department.trim() || avatarUrl.trim() || category !== 'teaching') {
            await supabase.from('staff_profiles').insert({
              ...staffPayload,
              user_id: id,
              school_id: staffSchoolId,
              active: true,
              attendance_exempt: false,
            });
          }
        }
      }
      await qc.invalidateQueries();
      toast.success('Details saved');
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (error as { message?: string }).message ?? 'Could not save details'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${name} details`}
        title={`Edit ${name} details`}
        onClick={load}
        disabled={busy}
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {kind === 'role' ? 'custom role' : 'staff & teacher profile'}</DialogTitle>
          </DialogHeader>
          {!loaded ? (
            <p>Loading details…</p>
          ) : (
            <form onSubmit={save} className="space-y-4">
              {kind === 'profile' && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/20">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={label || name} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-primary/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Staff Passport Photograph</p>
                    <p className="text-[11px] text-muted-foreground">
                      Official 35×45mm staff ID & portal photograph
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setPassportOpen(true)}
                      >
                        <Camera className="mr-1 h-3.5 w-3.5 text-primary" />
                        {avatarUrl ? 'Change Photo' : 'Upload / Capture Photo'}
                      </Button>
                      {avatarUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => setAvatarUrl('')}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`details-name-${id}`}>{kind === 'role' ? 'Role name' : 'Full name'}</Label>
                <Input
                  id={`details-name-${id}`}
                  required
                  minLength={kind === 'role' ? 2 : 1}
                  maxLength={kind === 'role' ? 80 : 200}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              {kind === 'profile' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`details-phone-${id}`}>Phone number</Label>
                    <Input
                      id={`details-phone-${id}`}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  {(sid || explicitSchoolId) && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`details-staffno-${id}`}>Staff ID</Label>
                        <Input
                          id={`details-staffno-${id}`}
                          placeholder="e.g. STF-001"
                          value={staffNo}
                          onChange={(e) => setStaffNo(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`details-dept-${id}`}>Department</Label>
                        <Input
                          id={`details-dept-${id}`}
                          placeholder="e.g. Sciences"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`details-cat-${id}`}>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger id={`details-cat-${id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teaching">Teaching</SelectItem>
                            <SelectItem value="non-teaching">Non-teaching</SelectItem>
                            <SelectItem value="management">Management</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {SCHOOL_PERMISSIONS.filter((p) => !['settings.edit', 'users.edit', 'audit.view'].includes(p)).map(
                    (p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={permissions.includes(p)}
                          onCheckedChange={(v) =>
                            setPermissions((current) =>
                              v ? [...current, p] : current.filter((key) => key !== p)
                            )
                          }
                        />
                        {p.replace('.', ' · ')}
                      </label>
                    )
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={busy || !label.trim() || (kind === 'role' && !permissions.length)}
              >
                {busy ? 'Saving…' : 'Save details'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {kind === 'profile' && (
        <PassportPhotoStudioModal
          open={passportOpen}
          onOpenChange={setPassportOpen}
          personName={label || name}
          personIdentifier={staffNo || undefined}
          currentPhotoUrl={avatarUrl || undefined}
          role="teacher"
          onSavePhoto={(dataUrl) => setAvatarUrl(dataUrl)}
        />
      )}
    </>
  );
}
