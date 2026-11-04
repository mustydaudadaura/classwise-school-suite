import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HEADERS = ["admission_no", "first_name", "last_name", "middle_name", "gender", "dob", "class_name", "parent_name", "parent_phone", "parent_email"];

type Row = Record<string, any>;

export function BulkImportDialog({ schoolId, classes, onDone }: { schoolId: string | null; classes: { id: string; name: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [classId, setClassId] = useState("");

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ["ADM/001", "Aisha", "Bello", "", "female", "2015-03-12", classes[0]?.name ?? "JSS 1A", "Musa Bello", "08031234567", ""]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    const data = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const norm = data.map((r) => {
      const o: Row = {};
      for (const k of Object.keys(r)) o[k.trim().toLowerCase().replace(/\s+/g, "_")] = typeof r[k] === "string" ? r[k].trim() : r[k];
      if (o.dob instanceof Date) o.dob = o.dob.toISOString().slice(0, 10);
      return o;
    }).filter((r) => r.admission_no && r.first_name && r.last_name);
    setRows(norm);
    if (!norm.length) toast.error("No valid rows. Use the template columns.");
  };


  const run = async () => {
    if (!schoolId) return toast.error("Set up your school first");
    if (!classId || !classes.some((c) => c.id === classId)) return toast.error("Select the class to assign these students to");
    setBusy(true);
    let ok = 0; const errs: string[] = [];
    const parentCache = new Map<string, string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const g = String(r.gender || "").toLowerCase();
      const { data: st, error } = await supabase.from("students").insert({
        school_id: schoolId,
        admission_no: String(r.admission_no),
        first_name: r.first_name, last_name: r.last_name,
        middle_name: r.middle_name || null,
        gender: g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : null,
        dob: r.dob ? String(r.dob) : null,
        class_id: classId,
      }).select("id").single();
      if (error || !st) { errs.push(`Row ${i + 2}: ${error?.message}`); setProgress(i + 1); continue; }
      const phone = String(r.parent_phone || "").replace(/\s+/g, "");
      if (r.parent_name || phone) {
        let pid = phone ? parentCache.get(phone) : undefined;
        if (!pid && phone) {
          const { data: ex } = await supabase.from("parents").select("id").eq("school_id", schoolId).eq("phone", phone).maybeSingle();
          pid = ex?.id;
        }
        if (!pid) {
          const { data: p } = await supabase.from("parents").insert({ school_id: schoolId, full_name: r.parent_name || "Parent", phone: phone || null, email: r.parent_email || null }).select("id").single();
          pid = p?.id;
        }
        if (pid) {
          if (phone) parentCache.set(phone, pid);
          await supabase.from("student_parents").insert({ student_id: st.id, parent_id: pid, is_primary: true });
        }
      }
      ok++; setProgress(i + 1);
    }
    setBusy(false);
    toast.success(`${ok} of ${rows.length} students imported`);
    if (errs.length) toast.error(errs.slice(0, 3).join("\n"));
    setRows([]); setProgress(0); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild><Button variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" /> Bulk import</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import students from Excel</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">Upload an Excel or CSV file. Parents with the same phone number are linked to all their children automatically. Choose the class first; every student in the file joins that class.</p>
          <Button variant="secondary" size="sm" onClick={template}><Download className="mr-2 h-4 w-4" /> Download template</Button>
          <div className="space-y-1">
            <p className="font-medium">Class to assign <span className="text-destructive">*</span></p>
            <Select value={classId} onValueChange={setClassId} disabled={busy}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
          {rows.length > 0 && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="font-medium">{rows.length} students ready</p>
              <p className="text-xs text-muted-foreground">{classId ? `All will be assigned to ${classes.find((c) => c.id === classId)?.name}` : "Select a class above before importing"}</p>
              {busy && <p className="mt-2">Importing {progress}/{rows.length}…</p>}
            </div>
          )}
          <Button className="w-full" disabled={!rows.length || !classId || busy} onClick={run}>{busy ? "Importing…" : "Import"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
