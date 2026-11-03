import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalContext, getPortalReportCards, getPortalAccessRules } from "@/lib/api/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Calendar, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/portal/report-cards")({
  head: () => ({
    meta: [
      { title: "Child Results — EduERP Parent Portal" },
      { name: "description", content: "View official terminal report cards for your child across sessions and terms." },
      { property: "og:title", content: "Child Results — EduERP Parent Portal" },
      { property: "og:description", content: "View official terminal report cards for your child across sessions and terms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const [selectedSession, setSelectedSession] = useState<string>("all");

  const { data: ctx } = useQuery({
    queryKey: ["portal-ctx", token],
    queryFn: () => getPortalContext({ data: { token: token! } }),
    enabled: !!token,
  });

  const activeSid = getActiveChildId();
  const kids = ctx?.students ?? [];
  const sid = kids.some((k: any) => k.id === activeSid) ? activeSid : kids[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["portal-rc", token, sid],
    queryFn: () => getPortalReportCards({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });

  const { data: rules } = useQuery({
    queryKey: ["portal-access-rules", token],
    queryFn: () => getPortalAccessRules({ data: { token: token! } }),
    enabled: !!token,
  });
  const allRows = data?.rows ?? [];
  const rows = selectedSession === "all" ? allRows : allRows.filter((r: any) => r.session === selectedSession);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Academic Report Cards</h2>
          <p className="text-xs text-muted-foreground">
            {rules?.mode === "scratch"
              ? `A scratch card is needed to open a report: ₦${rules.price.toLocaleString()} per card, ${rules.max_views} view(s), valid ${rules.validity_days} days.`
              : "Published terminal results for your child."}
          </p>
        </div>

        {/* Session filter chips */}
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg text-xs">
          <button
            onClick={() => setSelectedSession("all")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedSession === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedSession("2025/2026")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedSession === "2025/2026" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2025/2026
          </button>
          <button
            onClick={() => setSelectedSession("2024/2025")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedSession === "2024/2025" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2024/2025
          </button>
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading terminal reports…</CardContent></Card>
      )}

      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No published report cards for this filter.</CardContent></Card>
      )}

      {rows.map((r: any) => (
        <Card key={r.id} className="overflow-hidden hover:border-primary/50 transition-all shadow-sm">
          <CardHeader className="pb-2 bg-muted/30 flex flex-row items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-wide">
                {r.session} • {r.term} term
              </CardTitle>
            </div>
            <Badge className="bg-emerald-600 text-white text-[10px]">Official</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm divide-x divide-border">
              <div>
                <div className="text-xl font-black text-foreground">{Number(r.average ?? 0).toFixed(1)}%</div>
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">Average</div>
              </div>
              <div>
                <div className="text-xl font-black text-foreground">{r.position ?? "—"} / {r.class_size ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">Position</div>
              </div>
              <div>
                <div className="text-xl font-black text-foreground">{r.gpa ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">GPA</div>
              </div>
            </div>
            <Button asChild variant="default" className="w-full gap-1 shadow-sm">
              <Link to="/portal/report-card/$id" params={{ id: r.id }}>
                <Award className="h-4 w-4" /> View Full Report & Analysis
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
