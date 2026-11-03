import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalReportCardDetail } from "@/lib/api/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, KeyRound } from "lucide-react";
import { ReportCardView } from "@/components/ReportCardView";
import { formatPin } from "@/lib/scratch-cards";

export const Route = createFileRoute("/portal/report-card/$id")({
  head: () => ({ meta: [{ title: "Child Report Card — Alegacy Parent Portal" }, { name: "description", content: "Child Report Card for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Child Report Card — Alegacy Parent Portal" }, { property: "og:description", content: "Child Report Card for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { token } = useParentAuth();
  const [pin, setPin] = useState("");
  const [submittedPin, setSubmittedPin] = useState("");
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["portal-rc-detail", token, id, submittedPin],
    queryFn: () => getPortalReportCardDetail({ data: { token: token!, id, pin: submittedPin || undefined } }),
    enabled: !!token,
    staleTime: Infinity, // each opening with a PIN uses one view; don't re-use views on refocus
    gcTime: Infinity,
    retry: false,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading report card…</div>;

  const locked = data?.locked || (error && submittedPin);
  if (locked) {
    const rules = data?.locked ? data.rules : null;
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Link to="/portal/report-cards" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-primary" />Enter your scratch card PIN</div>
          <p className="text-sm text-muted-foreground">Your school requires a scratch card to view report cards.</p>
          {rules && (
            <ul className="text-sm space-y-1 rounded bg-muted/50 p-3">
              <li>Card price: <strong>₦{rules.price.toLocaleString()}</strong></li>
              <li>Views per card: <strong>{rules.max_views}</strong> (each opening uses one view)</li>
              <li>Valid for: <strong>{rules.validity_days} days</strong> from when the card was made</li>
              <li>One card works for one child only.</li>
            </ul>
          )}
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setSubmittedPin(pin.replace(/\D/g, "")); }}>
            <Input inputMode="numeric" autoComplete="off" placeholder="1234-5678-9012" value={formatPin(pin)} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} aria-label="Scratch card PIN" />
            {error && submittedPin && <p className="text-sm text-destructive">{(error as Error).message}</p>}
            <Button type="submit" className="w-full" disabled={pin.length !== 12 || isFetching}>{isFetching ? "Checking…" : "View report card"}</Button>
          </form>
        </div>
      </div>
    );
  }
  if (error || !data?.rc) return <div className="p-6 text-destructive text-sm">Report card not available.</div>;

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="print:hidden sticky top-0 z-10 border-b bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <Link to="/portal/report-cards" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Link>
        {data.access && (
          <span className="text-xs text-muted-foreground">Card {data.access.serial_no}: {data.access.remaining} view(s) left · valid until {new Date(data.access.valid_until).toLocaleDateString("en-NG")}</span>
        )}
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>
      <ReportCardView rc={data.rc} assessments={data.assessments as any} />
    </div>
  );
}
