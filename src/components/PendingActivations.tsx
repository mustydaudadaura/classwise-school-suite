import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RegistrationReview } from "@/components/RegistrationReview";

type Pending = { id: string; admission_no: string; first_name: string; last_name: string; classes?: { name?: string } | null };

export function PendingActivations({ students }: { students: Pending[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!students.length) return null;
  const ids = selected.filter(id => students.some(s => s.id === id));
  const allSelected = ids.length === students.length;

  const activate = async () => {
    if (!ids.length || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("activate_pending_students", { _ids: ids });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("No students were activated. Check that you manage this school.");
    toast.success(`${data} student${data === 1 ? "" : "s"} activated on the portal`);
    setSelected([]);
    await qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle>Awaiting activation ({students.length})</CardTitle>
        <CardDescription>Awaiting administrator approval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? students.map((s) => s.id) : [])} aria-label="Select all pending students" />
            Select all
          </label>
          <Button size="sm" onClick={activate} disabled={!ids.length || busy}>
            {busy ? "Activating…" : `Activate selected (${ids.length})`}
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {students.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <Checkbox
                checked={selected.includes(s.id)}
                onCheckedChange={(v) => setSelected((cur) => (v ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                aria-label={`Select ${s.first_name} ${s.last_name}`}
              />
              <span className="font-mono text-xs text-muted-foreground">{s.admission_no}</span>
              <span className="font-medium">{s.first_name} {s.last_name}</span>
              <span className="ml-auto text-muted-foreground">{s.classes?.name ?? "—"}</span>
              <RegistrationReview kind="students" id={s.id} name={`${s.first_name} ${s.last_name}`} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
