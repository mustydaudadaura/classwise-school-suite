import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldX, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/verify/$code")({
  head: () => ({ meta: [{ title: "Verify Result — EduERP" }, { name: "description", content: "Verify Result for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Verify Result — EduERP" }, { property: "og:description", content: "Verify Result for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_report_card", { _code: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center mb-2">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Result Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center text-muted-foreground">Verifying…</p>}
          {error && <p className="text-center text-destructive">Failed to verify.</p>}
          {!isLoading && !data && (
            <div className="text-center space-y-2">
              <ShieldX className="h-10 w-10 text-destructive mx-auto" />
              <p className="font-semibold">Invalid or unpublished result</p>
              <p className="text-xs text-muted-foreground">Code: {code}</p>
            </div>
          )}
          {data && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-700">
                <ShieldCheck className="h-5 w-5" /> <span className="font-semibold">Verified Authentic</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">School</dt><dd className="font-medium">{data.school_name}</dd>
                <dt className="text-muted-foreground">Student</dt><dd className="font-medium">{data.student_name}</dd>
                <dt className="text-muted-foreground">Admission No.</dt><dd className="font-mono">{data.admission_no}</dd>
                <dt className="text-muted-foreground">Class</dt><dd>{data.class_name}</dd>
                <dt className="text-muted-foreground">Session</dt><dd>{data.session}</dd>
                <dt className="text-muted-foreground">Term</dt><dd className="capitalize">{data.term}</dd>
                <dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{data.total_score}</dd>
                <dt className="text-muted-foreground">Average</dt><dd>{data.average}%</dd>
                <dt className="text-muted-foreground">Position</dt><dd>{data.position}</dd>
              </dl>
              <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
                Verification code: <span className="font-mono">{code}</span>
              </p>
              <div className="pt-2 text-center">
                <a
                  href={`/verify-credential?token=${encodeURIComponent(code)}`}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  View Full Official Verification Certificate →
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
