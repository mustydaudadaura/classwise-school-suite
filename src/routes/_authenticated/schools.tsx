import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Settings2, RefreshCw, Copy, Wand2, ExternalLink, Globe, Download } from "lucide-react";
import { toast } from "sonner";
import { BulkRegistryDelete } from "@/components/BulkRegistryDelete";
import { RegistryActions } from "@/components/RegistryActions";
import { schoolRegistrationSchema } from "@/lib/school-registration";
import { selectSchool } from "@/lib/school-access";

// Build a school code like "HGA-001" from the school name.
// Uses up to 3 initials + 3-digit random suffix, checks uniqueness in DB.
async function generateUniqueSchoolCode(name: string): Promise<string> {
  const initials =
    (name || "SCH")
      .replace(/[^A-Za-z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "SCH";
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    const code = `${initials}-${suffix}`;
    const { data, error } = await supabase.from("schools").select("id").eq("code", code).maybeSingle();
    if (error) throw error;
    if (!data) return code;
  }
  return `${initials}-${Date.now().toString().slice(-4)}`;
}

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({ meta: [{ title: "Schools — Alegacy" }, { name: "description", content: "Schools for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Schools — Alegacy" }, { property: "og:description", content: "Schools for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SchoolsPage,
});

type School = {
  id: string; name: string; code: string; address: string | null; active: boolean;
  phone: string | null; email: string | null; motto: string | null;
  logo_url: string | null; stamp_url: string | null; website: string | null;
  branch_name: string | null; principal_name: string | null;
  principal_signature_url: string | null; current_session: string | null;
  facebook_url: string | null; instagram_url: string | null; twitter_url: string | null;
  theme_color?: string | null;
};

async function uploadFile(file: File, prefix: string): Promise<string> {
  try {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true });
    if (!error) {
      const publicUrl = supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl;
      if (publicUrl && !publicUrl.includes("placeholder")) return publicUrl;
    }
  } catch {
    // Fall back to data URL for seamless local/preview persistence
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

function SchoolsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });

  const { data: schools, isLoading, error: schoolsError } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as School[];
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in with a registered Super Admin account to create a school.");
      const { data: allowed, error: roleError } = await supabase.rpc("is_super_admin", { _user_id: auth.user.id });
      if (roleError) throw roleError;
      if (!allowed) throw new Error("Sign in with a registered Super Admin account to create a school.");
      const code = form.code.trim() || await generateUniqueSchoolCode(form.name);
      const payload = schoolRegistrationSchema.parse({ ...form, code });
      const { data: saved, error } = await supabase.from("schools").insert(payload).select("id,code").single();
      if (error) throw error;
      if (!saved?.id) throw new Error("The school was not saved. Please try again.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["schools"] }), qc.invalidateQueries({ queryKey: ["layout-schools"] })]);
      toast.success(`School created · code ${saved.code}`);
      setOpen(false);
      setForm({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "School registration failed.");
    } finally {
      setCreating(false);
    }
  };

  const regenerateCode = async (s: School) => {
    if (!confirm(`Regenerate code for ${s.name}? Users signing up with the old code (${s.code}) will fail.`)) return;
    const code = await generateUniqueSchoolCode(s.name);
    const { error } = await supabase.from("schools").update({ code }).eq("id", s.id).select("id").single();
    if (error) return toast.error(error.message);
    toast.success(`New code: ${code}`);
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["layout-schools"] });
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  const exportSchoolsCSV = () => {
    if (!schools?.length) {
      toast.error("No schools to export");
      return;
    }
    const headers = ["School Name", "School Code", "Current Session", "Phone", "Email", "Address", "Motto"];
    const rows = schools.map((s) => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.code || "").replace(/"/g, '""')}"`,
      `"${(s.current_session || "").replace(/"/g, '""')}"`,
      `"${(s.phone || "").replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.address || "").replace(/"/g, '""')}"`,
      `"${(s.motto || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registered_schools_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${schools.length} schools to CSV!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schools & Academic Branding</h1>
          <p className="text-sm text-muted-foreground">Register schools, upload official logos, stamps, and principal signatures.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="text-xs font-semibold gap-1.5 shadow-2xs border-primary/40 hover:bg-primary/10"
            onClick={exportSchoolsCSV}
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            Export Bulk (CSV)
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Register New School</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create school</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Code</Label>
                  <div className="flex gap-1">
                    <Input
                      placeholder="Auto-generated"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Generate code"
                      onClick={async () => setForm({ ...form, code: await generateUniqueSchoolCode(form.name) })}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="col-span-2"><Label>Motto</Label><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></div>
                <div><Label>Session</Label><Input value={form.current_session} onChange={(e) => setForm({ ...form, current_session: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>{creating ? "Saving…" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>


      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>All schools</CardTitle><BulkRegistryDelete table="schools" label="schools" items={(schools ?? []).map((s: any) => ({ id: s.id, name: s.name }))} /></CardHeader>
        <CardContent>
          {schoolsError ? <p role="alert" className="text-destructive">Schools could not be loaded: {schoolsError.message}</p> : isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead>
                  <TableHead>Session</TableHead><TableHead>Phone</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools?.length ? schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {s.logo_url && <img src={s.logo_url} className="h-7 w-7 object-contain rounded" alt="" />}
                      {s.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{s.code}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(s.code)} title="Copy">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => regenerateCode(s)} title="Regenerate">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{s.current_session ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <RegistryActions table="schools" id={s.id} name={s.name} active={s.active} />
                        <Button size="sm" variant="outline" asChild><Link to="/settings" search={{ tab: "details" }} onClick={() => selectSchool(s.id)}>Edit details</Link></Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(s)}>
                          <Settings2 className="mr-1 h-3.5 w-3.5" /> Branding
                        </Button>
                        <Button size="sm" variant="secondary" className="h-8 text-xs font-medium" asChild>
                          <Link to="/s/$slug" params={{ slug: s.code.toLowerCase() }} target="_blank">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> View Website
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No schools yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditBrandingDialog
        school={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["schools"] });
          qc.invalidateQueries({ queryKey: ["layout-schools"] });
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditBrandingDialog({ school, onClose, onSaved }: { school: School | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<School>>({});
  const [saving, setSaving] = useState(false);

  if (!school) return null;
  const s = { ...school, ...draft };

  const setF = (k: keyof School, v: string | null) => setDraft({ ...draft, [k]: v });

  const onFile = async (k: keyof School, prefix: string, file: File | undefined) => {
    if (!file) return;
    try {
      const url = await uploadFile(file, `${school.id}/${prefix}`);
      setF(k, url);
      toast.success("Uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("schools").update(draft).eq("id", school.id).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>School branding — {school.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Public Website & Portal URL */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Official School Website: </span>
                <code className="text-primary font-mono font-medium">/s/{school.code.toLowerCase()}</code>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1 sm:flex-none"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${school.code.toLowerCase()}` : `/s/${school.code.toLowerCase()}`;
                  navigator.clipboard.writeText(url);
                  toast.success("School website link copied to clipboard!");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy Link
              </Button>
              <Button size="sm" variant="default" className="h-7 text-xs flex-1 sm:flex-none" asChild>
                <Link to="/s/$slug" params={{ slug: school.code.toLowerCase() }} target="_blank">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Website
                </Link>
              </Button>
            </div>
          </div>

          {/* Theme Color */}
          <div className="space-y-1.5 rounded-lg border p-3 bg-muted/20">
            <Label className="text-xs font-semibold">School Brand Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="color"
                className="w-10 h-8 p-0 cursor-pointer rounded border"
                value={s.theme_color || "#0a6d3b"}
                onChange={(e) => setF("theme_color", e.target.value)}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { name: "Forest Green", hex: "#0a6d3b" },
                  { name: "Royal Blue", hex: "#1e40af" },
                  { name: "Burgundy", hex: "#831843" },
                  { name: "Deep Purple", hex: "#581c87" },
                  { name: "Navy Blue", hex: "#0f172a" },
                  { name: "Amber / Gold", hex: "#b45309" },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setF("theme_color", c.hex)}
                    className="h-7 px-2.5 rounded-md text-[11px] font-medium border text-white shadow-xs transition-transform hover:scale-105"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <Label>Logo</Label>
              {s.logo_url && <img src={s.logo_url} alt="" className="h-16 w-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("logo_url", "logo", e.target.files?.[0])} />
            </div>
            <div>
              <Label>Stamp</Label>
              {s.stamp_url && <img src={s.stamp_url} alt="" className="h-16 w-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("stamp_url", "stamp", e.target.files?.[0])} />
            </div>
            <div>
              <Label>Principal signature</Label>
              {s.principal_signature_url && <img src={s.principal_signature_url} alt="" className="h-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("principal_signature_url", "sign", e.target.files?.[0])} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>School name</Label><Input value={s.name ?? ""} onChange={(e) => setF("name", e.target.value)} /></div>
            <div><Label>Motto</Label><Input value={s.motto ?? ""} onChange={(e) => setF("motto", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={s.website ?? ""} onChange={(e) => setF("website", e.target.value)} /></div>
            <div><Label>Branch name</Label><Input value={s.branch_name ?? ""} onChange={(e) => setF("branch_name", e.target.value)} /></div>
            <div><Label>Principal name</Label><Input value={s.principal_name ?? ""} onChange={(e) => setF("principal_name", e.target.value)} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={s.address ?? ""} onChange={(e) => setF("address", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={s.phone ?? ""} onChange={(e) => setF("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={s.email ?? ""} onChange={(e) => setF("email", e.target.value)} /></div>
            <div><Label>Facebook</Label><Input value={s.facebook_url ?? ""} onChange={(e) => setF("facebook_url", e.target.value)} /></div>
            <div><Label>Instagram</Label><Input value={s.instagram_url ?? ""} onChange={(e) => setF("instagram_url", e.target.value)} /></div>
            <div><Label>X (Twitter)</Label><Input value={s.twitter_url ?? ""} onChange={(e) => setF("twitter_url", e.target.value)} /></div>
            <div><Label>Current session</Label><Input value={s.current_session ?? ""} onChange={(e) => setF("current_session", e.target.value)} /></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
