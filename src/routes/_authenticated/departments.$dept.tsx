import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { useDepartmentHub, type DepartmentHubData } from "@/hooks/useDepartmentHub";
import { canOpenDepartment, canOpenLink, findDepartment, type HubStatKey } from "@/lib/departments";
import { DepartmentIcon } from "@/components/DepartmentIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/departments/$dept")({
  loader: ({ params }) => {
    const dept = findDepartment(params.dept);
    if (!dept) throw notFound();
    return { title: dept.title, description: dept.description };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — Alegacy` : "Department — Alegacy";
    const description = loaderData?.description ?? "School department in Alegacy.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DepartmentPage,
  notFoundComponent: () => (
    <div className="space-y-2"><h1 className="text-xl font-semibold">Department not found</h1><Link to="/departments" className="text-primary underline">See all departments</Link></div>
  ),
  errorComponent: ({ error }) => <p role="alert" className="text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

const STAT_LABEL: Record<HubStatKey, string> = {
  students: "Active students", boys: "Boys", girls: "Girls", staff: "Active staff",
  attendanceToday: "Attendance today", pendingSubmissions: "Awaiting review",
};

function statValue(key: HubStatKey, d: DepartmentHubData | undefined): string {
  if (!d) return "…";
  switch (key) {
    case "students": return d.students.toLocaleString("en-NG");
    case "boys": return d.boys.toLocaleString("en-NG");
    case "girls": return d.girls.toLocaleString("en-NG");
    case "staff": return d.staff == null ? "—" : d.staff.toLocaleString("en-NG");
    case "attendanceToday": return d.attendance.rate == null ? "Not marked" : `${d.attendance.rate}%`;
    case "pendingSubmissions": return d.pendingSubmissions.toLocaleString("en-NG");
  }
}

function DepartmentPage() {
  const { dept: slug } = Route.useParams();
  const dept = findDepartment(slug)!;
  const { roles, schoolId } = useAuth();
  const access = useSchoolAccess();
  const acc = { roles, can: access.can, granted: access.granted };
  const canSeeStaff = roles.includes("super_admin") || access.can("users.edit");
  const { data } = useDepartmentHub(dept.stats.length ? schoolId : null, canSeeStaff);

  if (!canOpenDepartment(dept, acc)) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Access unavailable</h1>
        <p className="text-muted-foreground">Your account does not have permission for {dept.title}.</p>
        <Link to="/dashboard" className="text-primary underline">Back to dashboard</Link>
      </div>
    );
  }
  const links = dept.links.filter((l) => canOpenLink(l, acc));
  const stats = dept.stats.filter((k) => k !== "staff" || canSeeStaff);

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      <div className="flex items-start gap-3 rounded-2xl border border-border p-4 sm:p-5" style={{ background: `color-mix(in oklab, ${dept.color} 9%, var(--card))` }}>
        <DepartmentIcon slug={dept.slug} color={dept.color} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{dept.title}</h1>
          <p className="text-sm text-muted-foreground">{dept.description}</p>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((k) => (
            <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{STAT_LABEL[k]}</p><p className="text-2xl font-bold" style={{ color: dept.color }}>{statValue(k, data)}</p></CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Open a section</CardTitle></CardHeader>
        <CardContent>
          {links.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {links.map((l) => (
                <Link key={`${l.to}-${l.label}`} to={l.to} className="group flex items-center justify-between gap-2 rounded-lg border border-border p-3 transition hover:border-primary/50 hover:bg-secondary/50">
                  <div className="min-w-0"><p className="font-medium">{l.label}</p><p className="text-xs text-muted-foreground">{l.description}</p></div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No sections are ready in this department yet.</p>}
        </CardContent>
      </Card>

      {dept.planned.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Coming next</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dept.planned.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {p.label}</span>
                  <Badge variant="outline" className="shrink-0">Phase {p.phase}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
