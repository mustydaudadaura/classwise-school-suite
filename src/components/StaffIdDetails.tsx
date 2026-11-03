import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IdCard } from "lucide-react";
import { toast } from "sonner";

type Form = { staff_no: string; position: string; department: string; category: string; photo_url: string | null; signature_url: string | null };
const EMPTY: Form = { staff_no: "", position: "", department: "", category: "teaching", photo_url: null, signature_url: null };

async function uploadImage(schoolId: string, userId: string, kind: "photo" | "signature", file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be smaller than 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${schoolId}/staff/${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl;
}

/** Staff ID-card details (number, position, photo, signature) stored on the staff profile used by ID cards. */
export function StaffIdDetails({
  userId, schoolId, name, open: controlledOpen, onOpenChange, hideTrigger,
}: { userId: string; schoolId: string | null; name: string; open?: boolean; onOpenChange?: (o: boolean) => void; hideTrigger?: boolean }) {
  const qc = useQueryClient();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !schoolId) return;
    setLoading(true); setError("");
    supabase.from("staff_profiles").select("staff_no, position, department, category, photo_url, signature_url")
      .eq("school_id", schoolId).eq("user_id", userId).maybeSingle()
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        setForm(data ? { staff_no: data.staff_no ?? "", position: data.position ?? "", department: data.department ?? "", category: data.category ?? "teaching", photo_url: data.photo_url, signature_url: data.signature_url } : EMPTY);
        setLoading(false);
      });
  }, [open, schoolId, userId]);

  const pick = async (kind: "photo" | "signature", file?: File) => {
    if (!file || !schoolId) return;
    setBusy(kind); setError("");
    try {
      const url = await uploadImage(schoolId, userId, kind, file);
      setForm((f) => ({ ...f, [kind === "photo" ? "photo_url" : "signature_url"]: url }));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!schoolId) return;
    setBusy("save"); setError("");
    try {
      const { data, error: e } = await supabase.from("staff_profiles").upsert({
        school_id: schoolId, user_id: userId,
        staff_no: form.staff_no.trim() || null, position: form.position.trim() || null,
        department: form.department.trim() || null, category: form.category,
        photo_url: form.photo_url, signature_url: form.signature_url,
      }, { onConflict: "school_id,user_id" }).select("id").maybeSingle();
      if (e) throw new Error(e.message);
      if (!data) throw new Error("The details were not saved. You may not have permission for this school.");
      await qc.invalidateQueries({ queryKey: ["idcard-staff"] });
      toast.success("Staff ID details saved");
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(null); }
  };

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!schoolId} onClick={() => setOpen(true)} title={schoolId ? "Photo, signature and ID card details" : "Assign this person to a school first"}>
          <IdCard className="mr-1 h-3.5 w-3.5" /> ID details
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff ID details — {name}</DialogTitle>
            <DialogDescription>The photo, signature and details here print on this staff member's ID card.</DialogDescription>
          </DialogHeader>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="sid-no">Staff number</Label><Input id="sid-no" value={form.staff_no} onChange={(e) => setForm({ ...form, staff_no: e.target.value })} placeholder="e.g. ATQ/STF/001" /></div>
                <div className="space-y-1"><Label htmlFor="sid-pos">Position</Label><Input id="sid-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Class Teacher" /></div>
                <div className="space-y-1"><Label htmlFor="sid-dep">Department</Label><Input id="sid-dep" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Sciences" /></div>
                <div className="space-y-1"><Label htmlFor="sid-cat">Category</Label>
                  <select id="sid-cat" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="teaching">Teaching</option><option value="non-teaching">Non-teaching</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sid-photo">Passport photo</Label>
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {form.photo_url ? <img src={form.photo_url} alt="Staff photo" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">No photo</span>}
                  </div>
                  <Input id="sid-photo" type="file" accept="image/*" capture="user" disabled={!!busy} onChange={(e) => pick("photo", e.target.files?.[0])} />
                  {busy === "photo" && <p className="text-xs text-muted-foreground">Uploading…</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sid-sign">Signature</Label>
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-md border bg-background">
                    {form.signature_url ? <img src={form.signature_url} alt="Staff signature" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No signature</span>}
                  </div>
                  <Input id="sid-sign" type="file" accept="image/*" disabled={!!busy} onChange={(e) => pick("signature", e.target.files?.[0])} />
                  {busy === "signature" && <p className="text-xs text-muted-foreground">Uploading…</p>}
                  <p className="text-xs text-muted-foreground">Sign on white paper and snap or upload it.</p>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={!!busy}>Cancel</Button>
                <Button onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save details"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
