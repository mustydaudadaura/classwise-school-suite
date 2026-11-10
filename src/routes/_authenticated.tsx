import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import alegacyLogo from "@/assets/alegacy-logo.png.asset.json";
import { useEffect } from "react";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, BookOpen, FileText, Building2, LogOut,
  GraduationCap, UserCog, Menu, X, Award, CalendarCheck, Wallet, Megaphone, ScrollText, MoonStar,
  UserCheck, Tablet, Activity,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { selectSchool, type SchoolPermission } from "@/lib/school-access";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentSearchTrigger, StudentSearchDialog } from "@/components/StudentSearch";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

const PAGE_ACCESS: Record<string, SchoolPermission> = { "/staff-attendance": "staffatt.view", "/kiosk": "staffatt.kiosk", "/students": "students.view", "/admissions": "students.view", "/classes": "academics.view", "/academics": "academics.view", "/islamic": "academics.view", "/promotion": "promotion.edit", "/results": "results.edit", "/attendance": "attendance.view", "/fees": "fees.view", "/announcements": "communication.view", "/report-cards": "results.view", "/report-distribution": "results.view", "/scratch-cards": "settings.edit", "/id-cards": "students.view", "/documents": "students.view", "/users": "users.edit", "/settings": "settings.edit" };

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "school_admin", "teacher", "form_master", "accountant", "student", "parent"] },
  { to: "/schools", label: "Schools Directory", icon: Building2, roles: ["super_admin"] },
  { to: "/admissions", label: "Admissions", icon: UserCog, roles: ["super_admin", "school_admin"] },
  { to: "/students", label: "Students", icon: Users, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/classes", label: "Classes & Subjects", icon: BookOpen, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/academics", label: "Teaching & Timetable", icon: CalendarCheck, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/islamic", label: "Islamic Programmes", icon: MoonStar, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/promotion", label: "Promotion", icon: GraduationCap, roles: ["super_admin", "school_admin"] },
  { to: "/results", label: "Results Entry", icon: FileText, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/staff-attendance", label: "Staff Attendance Portal", icon: UserCheck, roles: ["super_admin", "school_admin", "teacher", "form_master", "accountant"] },
  { to: "/kiosk", label: "Attendance Kiosk", icon: Tablet, roles: ["super_admin", "school_admin"] },
  { to: "/fees", label: "Fees & Finances", icon: Wallet, roles: ["super_admin", "school_admin", "accountant"] },
  { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["super_admin", "school_admin"] },
  { to: "/report-cards", label: "Report Cards", icon: Award, roles: ["super_admin", "school_admin", "teacher", "form_master", "student", "parent"] },
  { to: "/report-distribution", label: "Report PDFs & WhatsApp", icon: Award, roles: ["super_admin", "school_admin", "teacher", "form_master"] },
  { to: "/scratch-cards", label: "Result Scratch Cards", icon: Award, roles: ["super_admin", "school_admin"] },
  { to: "/id-cards", label: "ID Cards", icon: Award, roles: ["super_admin", "school_admin"] },
  { to: "/documents", label: "Certificates & Reports", icon: ScrollText, roles: ["super_admin", "school_admin"] },
  { to: "/users", label: "Staff & User Credentials", icon: UserCog, roles: ["super_admin", "school_admin"] },
  { to: "/settings", search: { tab: "reports" }, label: "Report Card Design", icon: Award, roles: ["super_admin", "school_admin"] },
  { to: "/settings", label: "School Settings", icon: Settings2, roles: ["super_admin", "school_admin"] },
  { to: "/diagnostics", label: "System Diagnostics", icon: Activity, roles: ["super_admin"] },
] as const;

function AuthedLayout() {
  const { user, loading, roles, fullName } = useAuth();
  const access = useSchoolAccess();
  // Strictly Super Admin only: School Administrators NEVER see the school switcher
  const canSwitchSchools = hasRole(roles, "super_admin");
  const schools = useQuery({
    queryKey: ["layout-schools"],
    enabled: canSwitchSchools || Boolean(access.schoolId),
    queryFn: async () => (await supabase.from("schools").select("id,name").order("name")).data ?? [],
  });
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (schools.data && schools.data.length > 0) {
      const exists = schools.data.some((s) => s.id === access.schoolId);
      if (!access.schoolId || !exists) {
        selectSchool(schools.data[0].id);
      }
    }
  }, [schools.data, access.schoolId]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      void 0;
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("sb-placeholder-auth-token");
      localStorage.removeItem("sb-placeholder-key-auth-token");
      window.dispatchEvent(new Event("eduerp-auth-change"));
    }
    navigate({ to: "/auth", replace: true });
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isSuper = hasRole(roles, "super_admin");
  const visibleNav = NAV.filter((n) => {
    if (n.to === "/dashboard") return true;
    if (n.to === "/schools") return isSuper;
    if (n.to === "/report-cards" && hasRole(roles, "parent", "student")) return true;
    if (isSuper) return true;
    const roleAllowed = (n.roles as readonly string[]).some((r) => roles.includes(r as any));
    if (!roleAllowed) return false;
    const permission = PAGE_ACCESS[n.to];
    return permission ? access.can(permission) : true;
  });
  const matchedPageAccessKey = Object.keys(PAGE_ACCESS).find(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  const permission = matchedPageAccessKey
    ? PAGE_ACCESS[matchedPageAccessKey]
    : location.pathname.startsWith("/report-card/")
    ? "results.view"
    : undefined;
  const isSuperOnlyRoute =
    location.pathname === "/schools" ||
    location.pathname.startsWith("/schools/") ||
    location.pathname === "/diagnostics" ||
    location.pathname.startsWith("/diagnostics/");
  const ownReports =
    (location.pathname === "/report-cards" || location.pathname.startsWith("/report-card/")) &&
    hasRole(roles, "parent", "student");
  const denied =
    (isSuperOnlyRoute && !isSuper) ||
    (!isSuper && Boolean(permission) && !ownReports && !access.can(permission!));


  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-64 -translate-x-full flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:h-auto lg:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src={alegacyLogo.url} alt="Alegacy Technologies logo" className="h-9 w-12 rounded-md bg-card object-contain p-0.5" />
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white leading-tight">Alegacy</span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-tight">School Workspace</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((n) => {
            const active = location.pathname.startsWith(n.to) && ("search" in n ? (location.search as { tab?: string }).tab === "reports" : (location.search as { tab?: string }).tab !== "reports");
            const Icon = n.icon;
            return (
              <Link
                key={n.label}
                to={n.to}
                search={"search" in n ? n.search : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/70">
            <div className="truncate font-medium text-sidebar-foreground">{fullName || user.email}</div>
            <div className="truncate">{roles.length ? roles.join(", ") : "No role assigned"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            {canSwitchSchools && schools.data && schools.data.length > 0 ? (
              <Select value={access.schoolId ?? undefined} onValueChange={selectSchool}>
                <SelectTrigger className="w-48 sm:w-60 max-w-[50vw]" aria-label="Active school">
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.data.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/80 text-xs font-semibold text-secondary-foreground border border-border">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="truncate max-w-[200px] sm:max-w-[320px]">
                  {schools.data?.find((s) => s.id === access.schoolId)?.name ?? "Assigned School Workspace"}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 max-w-md mx-2">
            <StudentSearchTrigger onOpen={() => setSearchOpen(true)} />
          </div>

          <div className="text-xs text-muted-foreground hidden md:block shrink-0">
            {new Date().toLocaleDateString("en-NG", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {access.loading ? (
            <p className="text-muted-foreground">Loading school access…</p>
          ) : denied ? (
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Access unavailable</h1>
              <p className="text-muted-foreground">
                {access.schoolId
                  ? "This page is disabled or your account does not have permission."
                  : "Select a school to continue."}
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <StudentSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </div>
  );
}
