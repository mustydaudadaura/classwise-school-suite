import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/verify-id/$code")({
  head: () => ({
    meta: [
      { title: "Verify ID Card — Alegacy" },
      { name: "description", content: "Check that a school student or staff ID card is genuine and still valid." },
      { property: "og:title", content: "Verify ID Card — Alegacy" },
      { property: "og:description", content: "Check that a school ID card is genuine and still valid." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyIdPage,
});

function VerifyIdPage() {
  const { code } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-id", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_id_card", { _code: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>ID card check</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Checking…</p>
            : error ? <p className="text-sm text-destructive">The check could not be completed. Please try again.</p>
            : !data ? (
              <div className="flex items-center gap-3 text-destructive"><ShieldX className="h-8 w-8" /><p className="font-semibold">This ID card is not recognised.</p></div>
            ) : (
              <div className="space-y-3">
                <div className={`flex items-center gap-3 ${data.valid ? "text-primary" : "text-destructive"}`}>
                  {data.valid ? <ShieldCheck className="h-8 w-8" /> : <ShieldX className="h-8 w-8" />}
                  <p className="font-semibold">{data.valid ? "Genuine and valid" : "Genuine but no longer valid"}</p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">School</dt><dd>{data.school_name}</dd>
                  <dt className="text-muted-foreground">{data.kind === "student" ? "Student" : "Staff"}</dt><dd>{data.holder_name}</dd>
                  <dt className="text-muted-foreground">{data.kind === "student" ? "Admission no." : "Staff no."}</dt><dd>{data.id_number || "—"}</dd>
                  <dt className="text-muted-foreground">{data.kind === "student" ? "Class" : "Department"}</dt><dd>{data.detail || "—"}</dd>
                  <dt className="text-muted-foreground">Issued</dt><dd>{new Date(data.issued_at).toLocaleDateString("en-NG")}</dd>
                </dl>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
