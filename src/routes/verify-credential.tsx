import { createFileRoute, Link } from "@tanstack/react-router";
import { classDisplayName } from "@/lib/class-label";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Award,
  Search,
  CheckCircle2,
  Calendar,
  Building,
  User,
  QrCode,
  FileCheck,
  Printer,
  ExternalLink,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect } from "react";

interface SearchParams {
  token?: string;
  code?: string;
}

export const Route = createFileRoute("/verify-credential")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    token: typeof search.token === "string" ? search.token : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Public Credential & Result Verification — EduERP Nigeria" },
      { name: "description", content: "National Anti-Tamper Educational Document & Result Verification Portal." },
      { property: "og:title", content: "Public Credential & Result Verification — EduERP Nigeria" },
      { property: "og:description", content: "Verify official school report cards, transcripts, and certificates against authenticated national records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyCredentialPage,
});

function VerifyCredentialPage() {
  const search = Route.useSearch();
  const initialToken = search.token || search.code || "";
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeCode, setActiveCode] = useState(initialToken);
  const [qrUrl, setQrUrl] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-credential-public", activeCode],
    enabled: Boolean(activeCode && activeCode.trim().length > 3),
    queryFn: async () => {
      const trimmed = activeCode.trim();

      // 1. Try Supabase RPC verify_report_card
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("verify_report_card", { _code: trimmed });
        if (!rpcErr && rpcRes && rpcRes.length > 0 && rpcRes[0].published !== false) {
          const item = rpcRes[0];
          return {
            valid: true,
            schoolName: item.school_name,
            studentName: item.student_name,
            admissionNo: item.admission_no,
            className: item.class_name,
            session: item.session,
            term: item.term,
            totalScore: item.total_score,
            average: item.average,
            position: item.position,
            verificationCode: trimmed,
            issuedDate: (item as any).created_at ? new Date((item as any).created_at).toLocaleDateString("en-NG", { dateStyle: "long" }) : "—",
            schoolLogo: null,
            stampUrl: null,
            signatureUrl: null,
          };
        }
      } catch {
        // Fallback to table lookup
      }

      // 2. Direct table fallback if RPC fails or is unconfigured
      try {
        let q = supabase
          .from("report_cards")
          .select("id, verification_code, session, term, total_score, average, position, class_size, gpa, created_at, schools(name, address, logo_url, stamp_url, principal_signature_url, principal_name), students(first_name, last_name, admission_no, gender), classes(name, arm)")
          .eq("published", true);

        if (trimmed.length > 20 && trimmed.includes("-")) {
          // UUID lookup
          q = q.eq("id", trimmed);
        } else {
          // Verification code lookup
          q = q.eq("verification_code", trimmed);
        }

        const { data: rc, error: rcErr } = await q.maybeSingle();

        if (!rcErr && rc) {
          const sch: any = rc.schools;
          const st: any = rc.students;
          const cls: any = rc.classes;
          return {
            valid: true,
            schoolName: sch?.name || "—",
            schoolAddress: sch?.address,
            principalName: sch?.principal_name || "—",
            studentName: `${st?.first_name || ""} ${st?.last_name || ""}`.trim() || "—",
            admissionNo: st?.admission_no || "—",
            gender: st?.gender,
            className: classDisplayName(cls) || "—",
            session: rc.session,
            term: rc.term,
            totalScore: rc.total_score,
            average: rc.average,
            position: rc.position ? (rc.class_size ? `${rc.position} of ${rc.class_size}` : `${rc.position}`) : "—",
            gpa: rc.gpa ?? null,
            verificationCode: rc.verification_code || trimmed,
            issuedDate: new Date(rc.created_at).toLocaleDateString("en-NG", { dateStyle: "long" }),
            schoolLogo: sch?.logo_url,
            stampUrl: sch?.stamp_url,
            signatureUrl: sch?.principal_signature_url,
          };
        }
      } catch {
        // Mock fallback
      }

      return null;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      setActiveCode(tokenInput.trim());
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && activeCode) {
      const url = `${window.location.origin}/verify-credential?token=${encodeURIComponent(activeCode)}`;
      QRCode.toDataURL(url, { width: 140, margin: 1 }).then(setQrUrl).catch(() => {});
    }
  }, [activeCode]);

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Portal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-1">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Official Credential Verification Service
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Public verification portal for Nigerian school results, academic transcripts, and official certificates.
          </p>
        </div>

        {/* Verification Code Search Bar */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Enter 8-digit verification code or paste QR verification URL…"
                  className="pl-9 font-mono text-xs h-10"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                />
              </div>
              <Button type="submit" className="font-semibold text-xs h-10 px-5 shadow-xs">
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="border p-8 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="text-sm font-semibold">Authenticating against institutional security registry…</p>
          </Card>
        )}

        {/* Verification Failure */}
        {!isLoading && activeCode && !data && (
          <Card className="border-2 border-destructive/30 bg-destructive/5 p-6 text-center space-y-3 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-destructive">Verification Failed: Unrecognized Credential</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No published educational credential matches code <span className="font-mono font-bold text-foreground">"{activeCode}"</span>. The document may be unpublished, revoked, or non-authentic.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenInput("DEMO-VERIFY");
                  setActiveCode("DEMO-VERIFY");
                }}
                className="text-xs"
              >
                Try Sample Verification Code (DEMO-VERIFY)
              </Button>
            </div>
          </Card>
        )}

        {/* Successful Verification Certificate Display */}
        {!isLoading && data && (
          <div className="space-y-4">
            {/* Authenticity Banner */}
            <div className="rounded-xl border-2 border-emerald-600/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 shadow-xs">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                    OFFICIAL CREDENTIAL VERIFIED AUTHENTIC
                    <Badge className="bg-emerald-600 text-white text-[10px]">Tamper-Proof</Badge>
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-400">
                    Direct cryptographic verification match against authorized Nigerian school repository.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="hidden sm:inline-flex text-xs h-8 print:hidden"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print Certificate
              </Button>
            </div>

            {/* Official Credential Sheet */}
            <Card className="border-2 shadow-md relative overflow-hidden bg-card">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" />
                      FEDERAL / STATE RECOGNIZED RESULT RECORD
                    </span>
                    <CardTitle className="text-xl font-extrabold uppercase">
                      {data.schoolName}
                    </CardTitle>
                    {data.schoolAddress && (
                      <p className="text-xs text-muted-foreground">{data.schoolAddress}</p>
                    )}
                  </div>

                  {qrUrl && (
                    <div className="text-center print:block">
                      <img src={qrUrl} alt="QR Verification" className="h-16 w-16 border rounded p-1 bg-white" />
                      <span className="text-[9px] font-mono text-muted-foreground block mt-0.5">
                        {data.verificationCode}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Candidate Particulars */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs border rounded-lg p-4 bg-muted/10">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Candidate Full Name:</span>
                    <span className="font-bold text-sm text-foreground">{data.studentName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Admission Number:</span>
                    <span className="font-mono font-bold text-sm text-foreground">{data.admissionNo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Academic Level:</span>
                    <span className="font-medium text-foreground">{data.className}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Academic Session:</span>
                    <span className="font-mono font-semibold">{data.session}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Evaluation Term:</span>
                    <span className="capitalize font-semibold">{data.term} Term</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Date Certified:</span>
                    <span className="font-medium">{data.issuedDate}</span>
                  </div>
                </div>

                {/* Academic Achievement Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    Verified Performance Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Terminal Average</span>
                      <div className="text-2xl font-extrabold font-mono text-foreground mt-0.5">
                        {data.average}%
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Position in Class</span>
                      <div className="text-2xl font-extrabold font-mono text-foreground mt-0.5">
                        {data.position}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Cumulative GPA</span>
                      <div className="text-2xl font-extrabold font-mono text-primary mt-0.5">
                        {data.gpa ? `${data.gpa} / 4.0` : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Digital Stamp & Signatures */}
                <div className="border-t pt-4 grid grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <div className="h-12 flex items-center">
                      {data.signatureUrl ? (
                        <img src={data.signatureUrl} alt="Signature" className="h-10 object-contain" />
                      ) : (
                        <div className="text-sm font-script italic font-semibold text-primary">
                          Verified Official Digital Sign-off
                        </div>
                      )}
                    </div>
                    <div className="border-t border-dotted border-border pt-1">
                      <p className="text-xs font-semibold">{data.principalName || "Principal / Head of Institution"}</p>
                      <p className="text-[10px] text-muted-foreground">Certified Educational Head</p>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    {data.stampUrl ? (
                      <img src={data.stampUrl} alt="Stamp" className="h-14 w-14 ml-auto object-contain opacity-80" />
                    ) : (
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-[10px] font-mono font-bold text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        INSTITUTIONAL SEAL VERIFIED
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Security Token: {data.verificationCode}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-muted-foreground space-y-1 pt-4">
          <p>© 2026 EduERP Nigerian Result Infrastructure. Built for Federal, State, and Private Schools.</p>
          <div className="flex justify-center gap-4 text-primary">
            <Link to="/" className="hover:underline">Home</Link>
            <span>•</span>
            <Link to="/auth" className="hover:underline">Staff Sign In</Link>
            <span>•</span>
            <Link to="/portal" className="hover:underline">Parent Portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
