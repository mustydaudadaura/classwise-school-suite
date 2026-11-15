import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { getReportCardDetail } from "@/lib/api/results.functions";
import { ReportCardView } from "@/components/ReportCardView";

export const Route = createFileRoute("/_authenticated/report-card/$id")({
  head: () => ({ meta: [{ title: "Report Card — Alegacy" }, { name: "description", content: "Report Card for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Report Card — Alegacy" }, { property: "og:description", content: "Report Card for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ReportCardPage,
});

function ReportCardPage() {
  const { id } = Route.useParams();
  const loadReportCard = useServerFn(getReportCardDetail);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-card", id],
    queryFn: () => loadReportCard({ data: { id } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading report card…</div>;
  if (error) return <div role="alert" className="p-8 text-destructive">Report card could not be loaded. Please try again.</div>;
  if (!data?.rc) return <div className="p-8 text-destructive">Report card not found.</div>;

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="print:hidden sticky top-0 z-10 border-b bg-card px-4 py-3 flex items-center justify-between">
        <Link to="/results" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to results
        </Link>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>
      <ReportCardView rc={data.rc} assessments={data.assessments as any} />
    </div>
  );
}
