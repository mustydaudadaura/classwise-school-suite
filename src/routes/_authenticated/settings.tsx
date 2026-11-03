import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, hasRole } from '@/hooks/useAuth';
import { useSchoolAccess } from '@/hooks/useSchoolAccess';
import { SCHOOL_MODULES, SCHOOL_PERMISSIONS, selectSchool } from '@/lib/school-access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Trash2, ShieldCheck, Settings2, History, Palette, GraduationCap, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { CampusManager } from '@/components/CampusManager';
import { ReportTemplateSettings } from '@/components/ReportTemplateSettings';
import { PositionRankingSettings } from '@/components/PositionRankingSettings';
import { Settings as ThemeSettings } from '@/components/Settings';
import { AcademicSettings } from '@/components/AcademicSettings';
import { RegistryActions } from '@/components/RegistryActions';
import { DigitalCredentialsManager } from '@/components/DigitalCredentialsManager';
import { RegisteredDetailsEditor } from '@/components/RegisteredDetailsEditor';

export const Route = createFileRoute('/_authenticated/settings')({
  head: () => ({ meta: [
    { title: 'School Settings — Alegacy' },
    { name: 'description', content: 'Manage school details, active modules, staff permissions and change history in Alegacy.' },
    { property: 'og:title', content: 'School Settings — Alegacy' },
    { property: 'og:description', content: 'School configuration and authorized staff access.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  validateSearch: (s: Record<string, unknown>): { tab?: string } => (typeof s.tab === 'string' ? { tab: s.tab } : {}),
  component: SettingsPage,
});

function SettingsPage() {
  const { roles, schoolId } = useAuth();
  const { can, loading } = useSchoolAccess();
  const schools = useQuery({ queryKey: ['settings-schools'], queryFn: async () => {
    const { data, error } = await supabase.from('schools').select('id,name').order('name');
    if (error) throw error; return data ?? [];
  } });
  const isSuper = hasRole(roles, 'super_admin');
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-bold">School settings</h1>
      {isSuper && <Select value={schoolId ?? undefined} onValueChange={selectSchool}>
        <SelectTrigger className="w-full sm:w-80" aria-label="School"><SelectValue placeholder="Select a school" /></SelectTrigger>
        <SelectContent>{schools.data?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>}
    </div>
    {!schoolId ? <p className="text-muted-foreground">Select a school.</p> : loading ? <p>Loading…</p> : !can('settings.edit') ? <p className="text-muted-foreground">School administrator access required.</p> : <SchoolSettings key={schoolId} schoolId={schoolId} />}
  </div>;
}

function SchoolSettings({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const { tab } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleId, setRoleId] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(0);
  const data = useQuery({ queryKey: ['school-settings', schoolId, page], queryFn: async () => {
    const responses = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('school_controls').select('*').eq('school_id', schoolId).maybeSingle(),
      supabase.from('school_custom_roles').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('school_role_assignments').select('*').eq('school_id', schoolId),
      supabase.from('profiles').select('user_id,full_name').eq('school_id', schoolId).order('full_name'),
      supabase.from('school_audit_logs').select('id,actor_id,action,entity,record_id,old_value,new_value,created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).range(page * 25, page * 25 + 24),
    ]);
    const error = responses.find(r => r.error)?.error;
    if (error) throw error;
    return { school: responses[0].data, controls: responses[1].data, customRoles: responses[2].data ?? [], assignments: responses[3].data ?? [], profiles: responses[4].data ?? [], audit: responses[5].data ?? [] };
  } });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['school-settings', schoolId] }); await qc.invalidateQueries({ queryKey: ['school-access'] }); };
  async function run(task: () => PromiseLike<{ error: { message: string } | null }>, message: string) {
    setBusy(true);
    try { const { error } = await task(); if (error) throw new Error(error.message); toast.success(message); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  }
  if (data.isPending) return <p>Loading…</p>;
  if (data.error || !data.data?.school) return <p role="alert">{data.error?.message ?? 'School not found'}</p>;
  const { school, controls, customRoles, assignments, profiles, audit } = data.data;
  const modules = controls?.enabled_modules ?? SCHOOL_MODULES.map(m => m.id);
  const sections = controls?.enabled_sections ?? ['nursery', 'primary', 'secondary'];
  return <Tabs defaultValue={tab ?? "details"} className="space-y-6">
    <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-9">
      <TabsTrigger value="details"><Settings2 className="mr-2 h-4 w-4" />Details</TabsTrigger>
      <TabsTrigger value="credentials"><Stamp className="mr-2 h-4 w-4 text-primary" />Stamp &amp; Sign</TabsTrigger>
      <TabsTrigger value="academics"><GraduationCap className="mr-2 h-4 w-4" />Grading &amp; CA</TabsTrigger>
      <TabsTrigger value="themes"><Palette className="mr-2 h-4 w-4" />Themes</TabsTrigger>
      <TabsTrigger value="modules">Modules</TabsTrigger>
      <TabsTrigger value="campuses">Campuses</TabsTrigger>
      <TabsTrigger value="reports">Report template</TabsTrigger>
      <TabsTrigger value="positions">Positions</TabsTrigger>
      <TabsTrigger value="permissions"><ShieldCheck className="mr-2 h-4 w-4" />Permissions</TabsTrigger>
      <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger>
    </TabsList>
    <TabsContent value="credentials"><DigitalCredentialsManager school={school} /></TabsContent>
    <TabsContent value="academics"><AcademicSettings school={school} /></TabsContent>
    <TabsContent value="themes"><ThemeSettings schoolId={schoolId} initialTheme={school.theme_color} /></TabsContent>
    <TabsContent value="campuses"><CampusManager schoolId={schoolId} /></TabsContent>
    <TabsContent value="reports"><ReportTemplateSettings key={school.id} school={school} /></TabsContent>
    <TabsContent value="positions"><PositionRankingSettings key={school.id} school={school} /></TabsContent>
    <TabsContent value="details">
      <form key={school.updated_at} className="space-y-6" onSubmit={e => {
        e.preventDefault(); const form = new FormData(e.currentTarget);
        const term = form.get('current_term');
        if (term !== 'first' && term !== 'second' && term !== 'third') return;
        void run(() => supabase.from('schools').update({
          name: String(form.get('name')),
          address: String(form.get('address')),
          phone: String(form.get('phone')),
          email: String(form.get('email')),
          motto: String(form.get('motto')),
          website: String(form.get('website')),
          branch_name: String(form.get('branch_name')),
          current_session: String(form.get('current_session')),
          current_term: term,
          principal_name: String(form.get('principal_name')),
        }).eq('id', schoolId), 'School details saved');
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{school.name}</h2>
            <p className="text-xs text-muted-foreground">Register your official school name, motto, and contact details for report cards and official documents.</p>
          </div>
          <Button disabled={busy} type="submit"><Save className="mr-2 h-4 w-4" />Save details</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['name', 'School name', school.name],
            ['motto', 'Motto', school.motto],
            ['principal_name', 'Principal / Head of School', school.principal_name],
            ['phone', 'Official Phone', school.phone],
            ['email', 'Official Email', school.email],
            ['website', 'Website', school.website],
            ['branch_name', 'Campus / Branch name', school.branch_name],
            ['current_session', 'Academic session', school.current_session],
          ] as [string, string, string | null][]).map(([id, label, value]) => (
            <div key={id}>
              <Label htmlFor={id}>{label}</Label>
              <Input id={id} name={id} defaultValue={value ?? ''} required={id === 'name' || id === 'current_session'} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={school.address ?? ''} />
          </div>
          <div>
            <Label htmlFor="current_term">Current term</Label>
            <select id="current_term" name="current_term" defaultValue={school.current_term ?? 'first'} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="first">First term</option>
              <option value="second">Second term</option>
              <option value="third">Third term</option>
            </select>
          </div>
          <div>
            <Label>School code</Label>
            <Input readOnly value={school.code} className="font-mono bg-muted" />
          </div>
        </div>
      </form>
      <fieldset disabled={busy} className="mt-8 space-y-3 border-t border-border pt-6"><legend className="text-base font-semibold">School sections</legend>
        <div className="flex flex-wrap gap-6">{['nursery', 'primary', 'secondary'].map(section => <label key={section} className="flex items-center gap-2 capitalize"><Checkbox checked={sections.includes(section)} onCheckedChange={checked => {
          const next = checked ? [...sections, section] : sections.filter(s => s !== section);
          if (!next.length) return toast.error('Keep at least one school section');
          void run(() => supabase.from('school_controls').upsert({ school_id: schoolId, enabled_modules: modules, enabled_sections: next }), 'Sections saved');
        }} />{section}</label>)}</div>
      </fieldset>
    </TabsContent>
    <TabsContent value="modules" className="divide-y divide-border">
      {SCHOOL_MODULES.map(module => <div key={module.id} className="flex items-center justify-between gap-4 py-5"><Label htmlFor={`module-${module.id}`} className="text-base">{module.name}</Label><Switch id={`module-${module.id}`} checked={modules.includes(module.id)} disabled={busy} onCheckedChange={checked => {
        if (!checked && !window.confirm(`Disable ${module.name} for ${school.name}? Existing records will be retained.`)) return;
        const next = checked ? [...modules, module.id] : modules.filter(m => m !== module.id);
        void run(() => supabase.from('school_controls').upsert({ school_id: schoolId, enabled_modules: next, enabled_sections: sections }), 'Module settings saved');
      }} /></div>)}
    </TabsContent>
    <TabsContent value="permissions" className="space-y-8">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(() => supabase.from('school_custom_roles').insert({ school_id: schoolId, name: roleName.trim(), permissions }), 'Custom role created'); }}>
        <h2 className="text-lg font-semibold">Custom staff role</h2>
        <div className="max-w-md"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={roleName} onChange={e => setRoleName(e.target.value)} required minLength={2} maxLength={80} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SCHOOL_PERMISSIONS.filter(p => !['settings.edit', 'users.edit', 'audit.view'].includes(p)).map(permission => <label key={permission} className="flex items-center gap-2 text-sm"><Checkbox checked={permissions.includes(permission)} onCheckedChange={checked => setPermissions(checked ? [...permissions, permission] : permissions.filter(p => p !== permission))} />{permission.replace('.', ' · ')}</label>)}</div>
        <Button disabled={busy || !permissions.length}>Create role</Button>
      </form>
      <div className="divide-y divide-border">{customRoles.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-medium">{r.name}</span><RegisteredDetailsEditor kind="role" id={r.id} name={r.name} /><RegistryActions table="school_custom_roles" id={r.id} name={r.name} active={r.active} /></div>)}</div>
      <form className="space-y-4 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); void run(() => supabase.from('school_role_assignments').insert({ school_id: schoolId, role_id: roleId, user_id: userId }), 'Staff role assigned'); }}>
        <h2 className="text-lg font-semibold">Assign custom role</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={roleId} onValueChange={setRoleId}><SelectTrigger aria-label="Custom role"><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{customRoles.filter(r => r.active).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
          <Select value={userId} onValueChange={setUserId}><SelectTrigger aria-label="Staff account"><SelectValue placeholder="Select staff account" /></SelectTrigger><SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</SelectItem>)}</SelectContent></Select>
        </div><Button disabled={busy || !roleId || !userId}>Assign role</Button>
      </form>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Custom role</TableHead><TableHead>Access</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {assignments.map(a => <TableRow key={a.id}><TableCell>{profiles.find(p => p.user_id === a.user_id)?.full_name ?? a.user_id}</TableCell><TableCell>{customRoles.find(r => r.id === a.role_id)?.name}</TableCell><TableCell className="max-w-xs whitespace-normal text-xs">{customRoles.find(r => r.id === a.role_id)?.permissions.join(', ')}</TableCell><TableCell><RegistryActions table="school_role_assignments" id={a.id} name="custom role assignment" active={a.active} /></TableCell></TableRow>)}
        {!assignments.length && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No custom staff assignments</TableCell></TableRow>}
      </TableBody></Table></div>
    </TabsContent>
    <TabsContent value="history" className="space-y-4">
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Changed by</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Changes</TableHead></TableRow></TableHeader><TableBody>
        {audit.map(a => <TableRow key={a.id}><TableCell className="whitespace-nowrap">{new Date(a.created_at).toLocaleString('en-NG')}</TableCell><TableCell>{profiles.find(p => p.user_id === a.actor_id)?.full_name ?? (a.actor_id ? 'Administrator' : 'System')}</TableCell><TableCell>{a.action}</TableCell><TableCell>{a.entity.replaceAll('_', ' ')}</TableCell><TableCell><details><summary className="cursor-pointer text-primary">View</summary><pre className="max-h-60 max-w-xs overflow-auto text-xs">{JSON.stringify({ before: a.old_value, after: a.new_value }, null, 2)}</pre></details></TableCell></TableRow>)}
        {!audit.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No changes recorded</TableCell></TableRow>}
      </TableBody></Table></div>
      <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page + 1}</span><Button variant="outline" disabled={audit.length < 25} onClick={() => setPage(page + 1)}>Next</Button></div>
    </TabsContent>
  </Tabs>;
}