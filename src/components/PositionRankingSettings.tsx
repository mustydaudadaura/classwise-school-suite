import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewClassRanking } from "@/lib/api/results.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RANKING_METHODS, DEFAULT_RANGES, computePositions, ordinal, resolveRanking, validateRanges,
  type RankRange, type RankingMethod,
} from "@/lib/position-ranking";

type School = { id: string; report_template: unknown; current_session?: string | null; current_term?: string | null };

export function PositionRankingSettings({ school }: { school: School }) {
  const qc = useQueryClient();
  const saved = resolveRanking(school.report_template);
  const [method, setMethod] = useState<RankingMethod>(saved.method);
  const [ranges, setRanges] = useState<RankRange[]>(saved.ranges.length ? saved.ranges : DEFAULT_RANGES);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState("");
  const [session, setSession] = useState(school.current_session ?? "");
  const [term, setTerm] = useState<"first" | "second" | "third">((school.current_term as any) || "first");
  const errors = method === "ranges" ? validateRanges(ranges) : [];
  const preview = useServerFn(previewClassRanking);

  const { data: classes = [] } = useQuery({
    queryKey: ["ranking-classes", school.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const previewQuery = useQuery({
    queryKey: ["ranking-preview", classId, session, term],
    queryFn: () => preview({ data: { class_id: classId, session, term } }),
    enabled: false,
  });

  const previewRows = useMemo(() => {
    const rows = previewQuery.data?.rows ?? [];
    if (!rows.length) return [];
    if (method === "ranges" && errors.length) return [];
    const pos = computePositions(rows, method, ranges);
    return [...rows]
      .map((r) => ({ ...r, position: pos.get(r.student_id) ?? null }))
      .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999) || b.average - a.average);
  }, [previewQuery.data, method, ranges, errors.length]);

  const setRange = (i: number, key: keyof RankRange, value: string) =>
    setRanges((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value === "" ? NaN : Number(value) } : r)));

  async function save() {
    if (errors.length) return toast.error(errors[0]);
    setBusy(true);
    try {
      const { data: current, error: readErr } = await supabase.from("schools").select("report_template").eq("id", school.id).single();
      if (readErr) throw readErr;
      const base = current?.report_template && typeof current.report_template === "object" ? (current.report_template as Record<string, unknown>) : {};
      const next: Record<string, unknown> = { ...base, ranking_method: method };
      if (method === "ranges") next.ranking_ranges = [...ranges].sort((a, b) => b.min - a.min);
      const { data, error } = await supabase.from("schools").update({ report_template: next as any }).eq("id", school.id).select("report_template").single();
      if (error || !data) throw new Error(error?.message ?? "Could not save");
      if ((data.report_template as any)?.ranking_method !== method) throw new Error("Setting was not saved");
      await qc.invalidateQueries({ queryKey: ["school-settings", school.id] });
      toast.success("Position ranking saved. It will be used the next time results are published.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">How positions are decided</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {RANKING_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-lg border p-3 text-left transition ${method === m.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
              >
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.help}</div>
              </button>
            ))}
          </div>

          {method === "ranges" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                An average belongs to a range from its "From" score up to, but not including, the next higher range's "From" score
                (so 94.6 counts in 90–94). The top range includes its "To" score. Students below the lowest range get no position.
              </p>
              {ranges.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <div><Label className="text-xs">From</Label><Input type="number" min={0} max={100} value={Number.isNaN(r.min) ? "" : r.min} onChange={(e) => setRange(i, "min", e.target.value)} /></div>
                  <div><Label className="text-xs">To</Label><Input type="number" min={0} max={100} value={Number.isNaN(r.max) ? "" : r.max} onChange={(e) => setRange(i, "max", e.target.value)} /></div>
                  <div><Label className="text-xs">Position</Label><Input type="number" min={1} value={Number.isNaN(r.position) ? "" : r.position} onChange={(e) => setRange(i, "position", e.target.value)} /></div>
                  <Button variant="ghost" size="icon" aria-label={`Remove range ${i + 1}`} onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const lowest = [...ranges].sort((a, b) => a.min - b.min)[0];
                  const max = lowest ? Math.max(0, lowest.min - 1) : 100;
                  setRanges((rs) => [...rs, { min: Math.max(0, max - 4), max, position: Math.max(0, ...rs.map((x) => x.position || 0)) + 1 }]);
                }}><Plus className="mr-1 h-4 w-4" />Add range</Button>
                <Button variant="ghost" size="sm" onClick={() => setRanges(DEFAULT_RANGES)}>Use example ranges</Button>
              </div>
              {errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Changing this never changes a student's total, average, grade or GPA — only the position.</p>
          <Button onClick={save} disabled={busy || errors.length > 0}><Save className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Save ranking method"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preview before publishing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger aria-label="Preview class"><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{[c.name, c.arm].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label="Session" placeholder="2025/2026" value={session} onChange={(e) => setSession(e.target.value)} />
            <Select value={term} onValueChange={(v) => setTerm(v as any)}>
              <SelectTrigger aria-label="Term"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="first">First term</SelectItem><SelectItem value="second">Second term</SelectItem><SelectItem value="third">Third term</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" disabled={!classId || session.length < 4 || previewQuery.isFetching} onClick={() => previewQuery.refetch()}>
              <Eye className="mr-2 h-4 w-4" />{previewQuery.isFetching ? "Loading…" : "Preview"}
            </Button>
          </div>
          {previewQuery.error && <p className="text-sm text-destructive">{(previewQuery.error as Error).message}</p>}
          {previewQuery.data && (
            <>
              {previewQuery.data.pending > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{previewQuery.data.pending} score(s) are not approved yet; publishing will be blocked until they are.</p>}
              {method === "ranges" && errors.length > 0 ? (
                <p className="text-sm text-destructive">Fix the ranges above to see the preview.</p>
              ) : previewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students in this class.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Average</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewRows.map((r) => (
                        <TableRow key={r.student_id}>
                          <TableCell className="font-semibold">{r.position == null ? <span className="text-muted-foreground">Outside ranges</span> : ordinal(r.position)}</TableCell>
                          <TableCell>{r.name}<div className="text-xs text-muted-foreground">{r.admission_no}</div></TableCell>
                          <TableCell className="text-right">{r.total_score}</TableCell>
                          <TableCell className="text-right">{r.average.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">This preview uses the method shown above, even before you save it.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
