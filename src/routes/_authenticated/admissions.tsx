import { checkScoreLimit } from "@/lib/score-limits";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Sparkles, Users, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AIAdmissionAssistant } from "@/components/admission/AIAdmissionAssistant";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({
    meta: [
      { title: "Admissions & AI Data Capture — EduERP" },
      { name: "description", content: "AI-assisted admission registration, document OCR, handwritten sheets, and applicant tracking." },
      { property: "og:title", content: "Admissions & AI Data Capture — EduERP" },
      { property: "og:description", content: "AI-assisted admission registration, document OCR, handwritten sheets, and applicant tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdmissionsPage,
});

const STAGES = ["inquiry", "applied", "screened", "accepted", "rejected", "enrolled"] as const;
const EMPTY = {
  first_name: "",
  last_name: "",
  middle_name: "",
  gender: "male",
  dob: "",
  class_applied_id: "",
  previous_school: "",
  parent_name: "",
  parent_phone: "",
  parent_email: "",
  relationship: "father",
  notes: "",
};

function AdmissionsPage() {
  const { schoolId } = useAuth();
  const { can } = useSchoolAccess();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ai-assistant" | "applications">("ai-assistant");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState(EMPTY);

  const { data: apps } = useQuery({
    queryKey: ["admissions", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions")
        .select("*, classes(name)")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-adm", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").eq("school_id", schoolId!).order("name")).data ?? [],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admissions"] });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    const application_no = `APP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { error } = await supabase.from("admissions").insert({
      ...form,
      gender: form.gender as "male" | "female",
      dob: form.dob || null,
      class_applied_id: form.class_applied_id || null,
      school_id: schoolId,
      application_no,
    });
    if (error) return toast.error(error.message);
    toast.success(`Application ${application_no} created`);
    setOpen(false);
    setForm(EMPTY);
    refresh();
  };

  const setStage = async (id: string, stage: string, score?: string) => {
    const patch: any = { stage };
    if (score !== undefined) patch.entrance_score = score === "" ? null : Number(score);
    const { error } = await supabase.from("admissions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const enroll = async (a: any) => {
    const admission_no = window.prompt("Admission number for this student:", a.application_no.replace("APP", "ADM"));
    if (!admission_no) return;
    const { data: st, error } = await supabase
      .from("students")
      .insert({
        school_id: a.school_id,
        admission_no,
        first_name: a.first_name,
        last_name: a.last_name,
        middle_name: a.middle_name,
        gender: a.gender,
        dob: a.dob,
        class_id: a.class_applied_id,
        previous_school: a.previous_school,
        state_of_origin: a.state_of_origin,
        admission_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    if (a.parent_name) {
      let parentId: string | undefined;
      if (a.parent_phone) {
        parentId = (
          await supabase
            .from("parents")
            .select("id")
            .eq("school_id", a.school_id)
            .eq("phone", a.parent_phone)
            .maybeSingle()
        ).data?.id;
      }
      if (!parentId) {
        parentId = (
          await supabase
            .from("parents")
            .insert({
              school_id: a.school_id,
              full_name: a.parent_name,
              phone: a.parent_phone || null,
              email: a.parent_email || null,
            })
            .select("id")
            .single()
        ).data?.id;
      }
      if (parentId) {
        await supabase.from("student_parents").insert({
          student_id: st.id,
          parent_id: parentId,
          relationship: a.relationship,
          is_primary: true,
        });
      }
    }
    await supabase.from("admissions").update({ stage: "enrolled", student_id: st.id }).eq("id", a.id);
    toast.success("Student enrolled and parent linked");
    refresh();
  };

  // Bulk Export (Genuine XLSX)
  const exportAdmissionsExcel = () => {
    if (!apps?.length) return toast.error("No admission records to export");

    const headers = [
      "Application No",
      "First Name",
      "Surname",
      "Middle Name",
      "Gender",
      "Date of Birth",
      "Class Applied",
      "Stage",
      "Entrance Score",
      "Parent Name",
      "Parent Phone",
      "Parent Email",
      "Relationship",
      "Previous School",
      "State of Origin",
      "Date Created",
    ];

    const dataRows = (apps ?? []).map((a: any) => [
      a.application_no,
      a.first_name,
      a.last_name,
      a.middle_name || "",
      a.gender || "",
      a.dob || "",
      a.classes?.name || "",
      a.stage || "inquiry",
      a.entrance_score ?? "",
      a.parent_name || "",
      String(a.parent_phone || ""),
      a.parent_email || "",
      a.relationship || "",
      a.previous_school || "",
      a.state_of_origin || "",
      new Date(a.created_at).toLocaleDateString("en-NG"),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 24 },
      { wch: 16 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admissions_Roster");
    XLSX.writeFile(wb, `Admissions_Roster_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Admissions export downloaded as Excel (XLSX)");
  };

  const counts = Object.fromEntries(STAGES.map((s) => [s, apps?.filter((a) => a.stage === s).length ?? 0]));
  const list = (apps ?? []).filter((a) => filter === "all" || a.stage === filter);
  const editable = can("students.edit");

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Admissions & Student Intake
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered registration sheet capture, document OCR, and applicant lifecycle management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAdmissionsExcel} className="text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export Admissions (XLSX)
          </Button>

          {editable && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Manual Application
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Student Application</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="grid grid-cols-2 gap-3 text-xs">
                  {([
                    ["first_name", "First name", true],
                    ["last_name", "Last name", true],
                    ["middle_name", "Middle name"],
                    ["dob", "Date of birth"],
                    ["previous_school", "Previous school"],
                    ["parent_name", "Parent name"],
                    ["parent_phone", "Parent phone"],
                    ["parent_email", "Parent email"],
                  ] as [keyof typeof EMPTY, string, boolean?][]).map(([k, l, req]) => (
                    <div key={k}>
                      <Label className="text-xs">{l}</Label>
                      <Input
                        required={req}
                        type={k === "dob" ? "date" : "text"}
                        value={form[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs">Gender</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Relationship</Label>
                    <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["father", "mother", "guardian", "sponsor"].map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Class applied for</Label>
                    <Select
                      value={form.class_applied_id}
                      onValueChange={(v) => setForm({ ...form, class_applied_id: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choose class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" className="col-span-2 mt-2">
                    Save application
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="ai-assistant" className="gap-2 text-xs sm:text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Admission Assistant
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2 text-xs sm:text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            Applicants & Pipeline ({apps?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Admission Assistant */}
        <TabsContent value="ai-assistant" className="space-y-4">
          {schoolId && <AIAdmissionAssistant schoolId={schoolId} classes={classes ?? []} onCompleted={refresh} />}
        </TabsContent>

        {/* Tab 2: Applications & Pipeline */}
        <TabsContent value="applications" className="space-y-4">
          {/* Pipeline Stage Pills */}
          <div className="grid grid-cols-3 gap-2 md:grid-cols-7">
            {["all", ...STAGES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-md border p-2 text-left text-xs capitalize transition-colors ${
                  filter === s ? "border-primary bg-primary/10 font-bold" : "border-border hover:bg-muted/40"
                }`}
              >
                <span className="block text-[10px] text-muted-foreground">{s}</span>
                <span className="font-semibold text-sm">{s === "all" ? apps?.length ?? 0 : counts[s]}</span>
              </button>
            ))}
          </div>

          {/* List of Applications */}
          <div className="space-y-2">
            {list.length ? (
              list.map((a: any) => (
                <Card key={a.id} className="hover:bg-muted/20 transition-colors">
                  <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground">
                        {a.first_name} {a.middle_name ? `${a.middle_name} ` : ""}{a.last_name}
                        <Badge variant="outline" className="ml-2 capitalize text-[10px]">
                          {a.stage}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        <span className="font-mono">{a.application_no}</span> · Class: {a.classes?.name ?? "Unassigned"} · Guardian: {a.parent_name || "—"} ({a.parent_phone || "No phone"})
                      </p>
                    </div>

                    {editable && a.stage !== "enrolled" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="w-20 h-8 text-xs font-mono"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="Score"
                          defaultValue={a.entrance_score ?? ""}
                          onBlur={(e) => {
                            if (e.target.value === String(a.entrance_score ?? "")) return;
                            const check = checkScoreLimit(e.target.value, 100, "Entrance score");
                            if (!check.ok) { toast.error(check.error); e.target.value = String(a.entrance_score ?? ""); return; }
                            setStage(a.id, a.stage, e.target.value);
                          }}
                        />
                        <Select value={a.stage} onValueChange={(v) => setStage(a.id, v)}>
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.filter((s) => s !== "enrolled").map((s) => (
                              <SelectItem key={s} value={s} className="capitalize text-xs">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {a.stage === "accepted" && (
                          <Button size="sm" onClick={() => enroll(a)} className="h-8 text-xs">
                            Enroll Student
                          </Button>
                        )}
                      </div>
                    )}

                    {a.student_id && (
                      <Link
                        to="/students/$id"
                        params={{ id: a.student_id }}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        View Student Profile →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8 text-xs">
                No applicant records in this stage.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
