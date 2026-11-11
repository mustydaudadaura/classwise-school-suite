import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { inviteStaff } from "@/lib/api/staff.functions";
import { EMPTY_STAFF, LOGIN_ROLES, STAFF_ROLES, staffRow, validateStaff, type StaffForm, type StaffRole } from "@/lib/staff-register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UserX, UserCheck, KeyRound, Search, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff Register — Alegacy Platform" },
      { name: "description", content: "Add and manage school staff: contact details, passport, staff ID, department, salary, bank details and optional portal login." },
      { property: "og:title", content: "Staff Register — Alegacy Platform" },
      { property: "og:description", content: "Add and manage school staff with optional portal logins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

type Row = {
  id: string; school_id: string; user_id: string | null; full_name: string; phone: string | null; email: string | null;
  role: string; staff_no: string | null; department: string | null; job_title: string | null; photo_url: string | null;
  monthly_salary: number; bank_name: string | null; account_number: string | null; account_name: string | null; active: boolean;
};

const roleLabel = (r: string) => STAFF_ROLES.find((x) => x.value === r)?.label ?? r;
const naira = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function StaffPage() {
  const { roles } = useAuth();
  const { schoolId } = useSchoolAccess();
  const allowed = hasRole(roles, "super_admin") || hasRole(roles, "school_admin");
  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_STAFF);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: ["staff-register", schoolId],
    enabled: Boolean(schoolId && allowed),
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").eq("school_id", schoolId!).order("full_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data ?? []).filter((r) =>
      (roleFilter === "all" || r.role === roleFilter) &&
      (!s || [r.full_name, r.phone, r.email, r.staff_no, r.department, r.job_title].some((v) => v?.toLowerCase().includes(s))));
  }, [list.data, q, roleFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY_STAFF); setError(""); setOpen(true); };
  const openEdit = (r: Row) => {
    setEditing(r); setError("");
    setForm({
      full_name: r.full_name, phone: r.phone ?? "", email: r.email ?? "", role: r.role as StaffRole,
      staff_no: r.staff_no ?? "", department: r.department ?? "", job_title: r.job_title ?? "", photo_url: r.photo_url,
      monthly_salary: r.monthly_salary ? String(r.monthly_salary) : "", bank_name: r.bank_name ?? "",
      account_number: r.account_number ?? "", account_name: r.account_name ?? "", create_login: false, password: "",
    });
    setOpen(true);
  };

  const uploadPhoto = async (file?: File) => {
    if (!file || !schoolId) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return setError("Photo must be smaller than 5 MB");
    setUploading(true); setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${schoolId}/staff/register/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await supabase.storage.from("school-assets").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (e) return setError(e.message);
    setForm((f) => ({ ...f, photo_url: supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Select a school first");
      const hasLogin = Boolean(editing?.user_id);
      const msg = validateStaff(form, { isNew: !editing, hasLogin });
      if (msg) throw new Error(msg);
      const row = staffRow(form);
      let userId = editing?.user_id ?? null;
      if (form.create_login && !hasLogin) {
        const res = await invite({ data: { email: row.email!, full_name: row.full_name, role: form.role as "teacher" | "school_admin" | "accountant", school_id: schoolId, initial_password: form.password || undefined } });
        userId = res.user_id;
      }
      const payload = { ...row, school_id: schoolId, user_id: userId };
      const result = editing
        ? await supabase.from("staff_members").update(payload).eq("id", editing.id).select("id").maybeSingle()
        : await supabase.from("staff_members").insert(payload).select("id").maybeSingle();
      if (result.error) throw new Error(result.error.code === "23505" ? "That staff number or login is already used in this school" : result.error.message);
      if (!result.data) throw new Error("The staff record was not saved. You may not have permission for this school.");
      if (userId) {
        // Keep the ID-card / attendance staff profile in step with the register.
        await supabase.from("staff_profiles").upsert({
          school_id: schoolId, user_id: userId, staff_no: row.staff_no, department: row.department, position: row.job_title,
          category: row.role === "non_teaching" ? "non-teaching" : "teaching", ...(row.photo_url ? { photo_url: row.photo_url } : {}),
        }, { onConflict: "school_id,user_id" });
      }
      return { createdLogin: form.create_login && !hasLogin };
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["staff-register"] });
      toast.success(editing ? "Staff details updated" : r.createdLogin ? "Staff added with a portal login" : "Staff added");
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (r: Row) => {
      const { data, error } = await supabase.from("staff_members").update({ active: !r.active }).eq("id", r.id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Not saved");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-register"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (r: Row) => {
      const { data, error } = await supabase.from("staff_members").delete().eq("id", r.id).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Not deleted. You may not have permission.");
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["staff-register"] }); toast.success("Staff record deleted"); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed) return <p className="p-6 text-sm text-muted-foreground">Only the Super Admin and School Administrators can manage staff.</p>;
  if (!schoolId) return <p className="p-6 text-sm text-muted-foreground">Select a school first.</p>;

  const total = list.data?.length ?? 0;
  const active = list.data?.filter((r) => r.active).length ?? 0;
  const withLogin = list.data?.filter((r) => r.user_id).length ?? 0;
  const payroll = list.data?.filter((r) => r.active).reduce((s, r) => s + Number(r.monthly_salary || 0), 0) ?? 0;
  const set = <K extends keyof StaffForm>(k: K, v: StaffForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canLogin = LOGIN_ROLES.includes(form.role);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff Register</h1>
          <p className="text-sm text-muted-foreground">Every staff member in the school. A portal login is optional.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add staff</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Total staff", total], ["Active", active], ["With portal login", withLogin], ["Monthly salaries", naira(payroll)]].map(([l, v]) => (
          <Card key={String(l)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, phone, staff no…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Filter by role" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {list.isPending ? <p className="text-sm text-muted-foreground">Loading staff…</p>
        : list.error ? <p className="text-sm text-destructive">Could not load staff: {(list.error as Error).message}</p>
        : rows.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{total ? "No staff match your search." : "No staff yet. Press “Add staff” to register the first one."}</CardContent></Card>
        : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <Card key={r.id} className={r.active ? "" : "opacity-60"}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {r.photo_url ? <img src={r.photo_url} alt={r.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-lg font-bold text-muted-foreground">{r.full_name.charAt(0)}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.job_title || roleLabel(r.role)}{r.department ? ` · ${r.department}` : ""}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary">{roleLabel(r.role)}</Badge>
                        {r.staff_no && <Badge variant="outline">{r.staff_no}</Badge>}
                        {r.user_id && <Badge variant="outline"><KeyRound className="mr-1 h-3 w-3" />Login</Badge>}
                        {!r.active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {r.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</p>}
                    {r.email && <p className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{r.email}</p>}
                    <p>Salary: <span className="font-medium text-foreground">{naira(r.monthly_salary)}</span>{r.bank_name ? ` · ${r.bank_name} ${r.account_number ?? ""}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                    <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(r)}>
                      {r.active ? <><UserX className="mr-1 h-3.5 w-3.5" />Deactivate</> : <><UserCheck className="mr-1 h-3.5 w-3.5" />Activate</>}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(r)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={(o) => !save.isPending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.full_name}` : "Add staff"}</DialogTitle>
            <DialogDescription>Fields marked * are required. Salary and bank details are only visible to administrators.</DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }}>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Personal details</h3>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <div className="h-28 w-24 overflow-hidden rounded-md border bg-muted">
                    {form.photo_url ? <img src={form.photo_url} alt="Passport" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Passport</div>}
                  </div>
                  <Label htmlFor="st-photo" className="block cursor-pointer text-xs text-primary underline">{uploading ? "Uploading…" : "Snap / upload"}</Label>
                  <input id="st-photo" type="file" accept="image/*" capture="user" className="hidden" disabled={uploading} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor="st-name">Full name *</Label><Input id="st-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="st-phone">Phone *</Label><Input id="st-phone" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08012345678" /></div>
                  <div className="space-y-1"><Label htmlFor="st-email">Email</Label><Input id="st-email" type="email" value={form.email} disabled={Boolean(editing?.user_id)} onChange={(e) => set("email", e.target.value)} /></div>
                </div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Job details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="st-role">Role *</Label>
                  <select id="st-role" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} disabled={Boolean(editing?.user_id)} onChange={(e) => set("role", e.target.value as StaffRole)}>
                    {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select></div>
                <div className="space-y-1"><Label htmlFor="st-no">Staff ID</Label><Input id="st-no" value={form.staff_no} onChange={(e) => set("staff_no", e.target.value)} placeholder="e.g. ATQ/STF/001" /></div>
                <div className="space-y-1"><Label htmlFor="st-dep">Department</Label><Input id="st-dep" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Sciences" /></div>
                <div className="space-y-1"><Label htmlFor="st-job">Job title</Label><Input id="st-job" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="e.g. Mathematics Teacher" /></div>
              </div>
              {editing?.user_id && <p className="text-xs text-muted-foreground">This person has a portal login, so email and role are changed on the Staff & User Credentials page.</p>}
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Salary & bank</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="st-sal">Monthly salary (₦)</Label><Input id="st-sal" inputMode="decimal" value={form.monthly_salary} onChange={(e) => set("monthly_salary", e.target.value)} placeholder="0" /></div>
                <div className="space-y-1"><Label htmlFor="st-bank">Bank name</Label><Input id="st-bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="e.g. Access Bank" /></div>
                <div className="space-y-1"><Label htmlFor="st-acc">Account number</Label><Input id="st-acc" inputMode="numeric" maxLength={10} value={form.account_number} onChange={(e) => set("account_number", e.target.value.replace(/\D/g, ""))} /></div>
                <div className="space-y-1"><Label htmlFor="st-accn">Account name</Label><Input id="st-accn" value={form.account_name} onChange={(e) => set("account_name", e.target.value)} /></div>
              </div>
            </section>
            {!editing?.user_id && (
              <section className="space-y-3 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={form.create_login} disabled={!canLogin} onChange={(e) => set("create_login", e.target.checked)} />
                  Give this person a portal login
                </label>
                {!canLogin ? <p className="text-xs text-muted-foreground">Non-teaching staff are kept on the register only (no login).</p>
                  : form.create_login && (
                    <div className="space-y-1"><Label htmlFor="st-pw">Initial password *</Label>
                      <Input id="st-pw" type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
                      <p className="text-xs text-muted-foreground">They sign in with the email above and this password. If the email already has an account, the password is ignored.</p></div>
                  )}
              </section>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || uploading}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Add staff"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.full_name}?</DialogTitle>
            <DialogDescription>This removes them from the staff register. {confirmDelete?.user_id ? "Their portal login is not removed — do that on the Staff & User Credentials page." : ""} To keep their history, use Deactivate instead.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete)}>{remove.isPending ? "Deleting…" : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
