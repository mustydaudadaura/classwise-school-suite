import type { kioskBoard } from "@/lib/api/staff-attendance.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const naira = (n: number) => (n > 0 ? `₦${Math.round(n).toLocaleString()}` : "0");

type Day = Awaited<ReturnType<typeof kioskBoard>>["today"];
export function DayBoard({ title, day }: { title: string; day: Day }) {
  const c = day.counts;
  const tiles: [number, string, string][] = [[c.onTime, "On time", "bg-primary/10 text-primary"], [c.late, "Late", "bg-accent text-accent-foreground"], [c.stillIn, "Still in", "bg-secondary text-secondary-foreground"], [c.missedOut, "Missed out", "bg-destructive/10 text-destructive"], [c.absent, "Absent", "bg-destructive/10 text-destructive"]];
  const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  return (
    <Card><CardContent className="space-y-4 p-6">
      <div className="flex items-baseline justify-between"><h2 className="text-2xl font-bold">{title}</h2><span className="text-sm text-muted-foreground">{label}{day.holiday ? ` · ${day.holiday}` : ""}</span></div>
      <div className="grid grid-cols-5 gap-2">{tiles.map(([n, l, cls]) => <div key={l} className={`rounded-xl p-3 text-center ${cls}`}><p className="text-2xl font-bold">{n}</p><p className="text-[10px] uppercase sm:text-xs">{l}</p></div>)}</div>
      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Late</TableHead><TableHead className="text-right">Deduction</TableHead></TableRow></TableHeader>
          <TableBody>{day.rows.map((r, i) => {
            const st = r.stillIn ? "Signed in" : r.missedOut ? "Missed out" : r.status === "late" ? "Late" : r.status === "present" ? "On time" : r.status === "absent" ? "Absent" : r.status === "not_yet" ? "—" : r.status.replace("_", " ");
            return <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell><Badge variant={r.status === "absent" || r.missedOut ? "destructive" : "secondary"} className="uppercase">{st}</Badge></TableCell>
              <TableCell className="text-right">{r.late ? `${r.lateMinutes}m` : "—"}</TableCell><TableCell className={`text-right ${r.penalty > 0 ? "text-destructive" : "text-primary"}`}>{naira(r.penalty)}</TableCell></TableRow>;
          })}{!day.rows.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No active staff yet.</TableCell></TableRow>}</TableBody></Table>
      </div>
    </CardContent></Card>
  );
}
