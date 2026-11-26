import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { visibleDepartments } from "@/lib/departments";
import { DepartmentIcon } from "@/components/DepartmentIcon";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/departments/")({
  head: () => ({
    meta: [
      { title: "All Departments — Alegacy" },
      { name: "description", content: "Every school department in Alegacy: student affairs, HR, academics, finance, attendance and more." },
      { property: "og:title", content: "All Departments — Alegacy" },
      { property: "og:description", content: "Open any school department and manage its records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { roles } = useAuth();
  const access = useSchoolAccess();
  const depts = visibleDepartments({ roles, can: access.can });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All Departments</h1>
        <p className="text-sm text-muted-foreground">Departments you can open with your role.</p>
      </div>
      {depts.length === 0 && <p className="text-sm text-muted-foreground">Your account has no department access yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {depts.map((d) => (
          <Link key={d.slug} to="/departments/$dept" params={{ dept: d.slug }} className="block">
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: `color-mix(in oklab, ${d.color} 7%, var(--card))` }}>
              <CardContent className="flex items-start gap-3 p-4">
                <DepartmentIcon slug={d.slug} color={d.color} className="h-9 w-9 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-sm text-muted-foreground">{d.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
