import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, ShieldAlert, UserCog, UserPlus, KeyRound, Copy,
  CheckCircle2, XCircle, AlertTriangle, Trash2, UserX, UserCheck2,
  Building2, BookOpen, Wallet, Users, Search, Filter, RefreshCw, Check, GraduationCap,
  Eye, EyeOff,
} from "lucide-react";
import { StaffAccessRegistry } from "@/components/StaffAccessRegistry";
import { RegisteredDetailsEditor } from "@/components/RegisteredDetailsEditor";
import { toast } from "sonner";
import { useAuth, hasRole } from "@/hooks/useAuth";
import {
  listPlatformUsers,
  createPlatformUser,
  assignUserRole,
  revokeUserRole,
  setUserAccountStatus,
  deleteUserAccount,
  listRegistrationCodes,
  createRegistrationCode,
  revokeRegistrationCode,
} from "@/lib/api/rbac.functions";
import type { PlatformUserRecord, RegistrationCode } from "@/lib/server/rbac-store.server";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles — Alegacy Platform" },
      { name: "description", content: "Role-based access control, user accounts, and school registration code management." },
      { property: "og:title", content: "Users & Roles — Alegacy Platform" },
      { property: "og:description", content: "Role-based access control, user accounts, and school registration code management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type AppRole = "super_admin" | "school_admin" | "teacher" | "form_master" | "accountant" | "student" | "parent";

const ROLE_CONFIG: Record<
  AppRole,
  { label: string; badgeClass: string; icon: any; description: string }
> = {
  super_admin: {
    label: "Super Admin",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    icon: ShieldCheck,
    description: "Platform Owner. Unrestricted access to all schools, user roles, registration codes, and system settings.",
  },
  school_admin: {
    label: "School Administrator",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    icon: Building2,
    description: "Manages all administrative, academic, and operational records strictly within their assigned school.",
  },
  form_master: {
    label: "Form Master",
    badgeClass: "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
    icon: GraduationCap,
    description: "Class & Arm Manager: Student attendance, conduct remarks, broadsheet analysis, and report cards.",
  },
  teacher: {
    label: "Teacher",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    icon: BookOpen,
    description: "Access to assigned classes, lesson notes, attendance, and exam score entry. No financial or role access.",
  },
  accountant: {
    label: "Accountant",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    icon: Wallet,
    description: "Authorized financial scope only: fee collection, payment records, receipts, and school expense reports.",
  },
  student: {
    label: "Student",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
    icon: Users,
    description: "Student portal access to personal grades, report cards, and class schedule.",
  },
  parent: {
    label: "Parent",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    icon: Users,
    description: "Parent portal access for linked children results, fee invoices, and school notices.",
  },
};

function UsersPage() {
  const { roles: myRoles, schoolId: mySchoolId, user } = useAuth();
  const isSuper = hasRole(myRoles, "super_admin");
  const isSchoolAdmin = hasRole(myRoles, "school_admin");
  const qc = useQueryClient();

  // Server functions
  const listUsersFn = useServerFn(listPlatformUsers);
  const createUserFn = useServerFn(createPlatformUser);
  const assignRoleFn = useServerFn(assignUserRole);
  const revokeRoleFn = useServerFn(revokeUserRole);
  const setStatusFn = useServerFn(setUserAccountStatus);
  const deleteUserFn = useServerFn(deleteUserAccount);
  const listCodesFn = useServerFn(listRegistrationCodes);
  const createCodeFn = useServerFn(createRegistrationCode);
  const revokeCodeFn = useServerFn(revokeRegistrationCode);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  // Modals state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: "",
    email: "",
    role: "teacher" as AppRole,
    schoolId: "",
    password: "StaffPass#2026",
  });
  const [createdCreds, setCreatedCreds] = useState<{
    user: PlatformUserRecord;
    password?: string;
  } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);
  const [codeSuccessDialog, setCodeSuccessDialog] = useState<RegistrationCode | null>(null);

  const [roleModalUser, setRoleModalUser] = useState<PlatformUserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("teacher");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  const [deleteModalUser, setDeleteModalUser] = useState<PlatformUserRecord | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [newCodeForm, setNewCodeForm] = useState({
    schoolId: "",
    targetRole: "school_admin" as "school_admin" | "teacher" | "accountant",
    isSingleUse: true,
    maxUses: 1,
    notes: "",
    expiresInDays: 30,
  });

  // Queries
  const { data: schools } = useQuery({
    queryKey: ["schools-list-rbac"],
    queryFn: async () => (await supabase.from("schools").select("id, name, code").order("name")).data ?? [],
  });

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["platform-users", mySchoolId, isSuper],
    queryFn: () => listUsersFn({ data: { schoolId: isSuper ? undefined : mySchoolId } }),
  });

  const { data: codesData, isLoading: codesLoading, refetch: refetchCodes } = useQuery({
    queryKey: ["registration-codes"],
    enabled: isSuper,
    queryFn: () => listCodesFn(),
  });

  // Mutations
  const assignRoleMut = useMutation({
    mutationFn: async () => {
      if (!roleModalUser) return;
      const schoolObj = schools?.find((s) => s.id === selectedSchoolId);
      return assignRoleFn({
        data: {
          userId: roleModalUser.userId,
          role: selectedRole,
          schoolId: selectedRole === "super_admin" ? null : selectedSchoolId || null,
          schoolName: selectedRole === "super_admin" ? "All Schools (Platform Owner)" : schoolObj?.name ?? "Assigned School",
        },
      });
    },
    onSuccess: () => {
      toast.success("User role updated successfully.");
      setRoleModalUser(null);
      refetchUsers();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: "active" | "deactivated" | "suspended" }) => {
      return setStatusFn({ data: { userId, status: newStatus } });
    },
    onSuccess: (res) => {
      toast.success(`Account status updated to ${res.status}.`);
      refetchUsers();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeRoleMut = useMutation({
    mutationFn: async (userId: string) => {
      return revokeRoleFn({ data: { userId } });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      refetchUsers();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUserMut = useMutation({
    mutationFn: async () => {
      if (!deleteModalUser) throw new Error("Select a user to delete.");
      return deleteUserFn({
        data: {
          userId: deleteModalUser.userId,
          confirmationText: deleteConfirmText,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setDeleteModalUser(null);
      setDeleteConfirmText("");
      refetchUsers();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createUserMut = useMutation({
    mutationFn: async () => {
      const activeSchoolId =
        newUserForm.schoolId ||
        mySchoolId ||
        schools?.[0]?.id ||
        null;
      const targetSchoolId = newUserForm.role === "super_admin" ? null : activeSchoolId;
      const schoolObj = schools?.find((s) => s.id === targetSchoolId);

      return createUserFn({
        data: {
          fullName: newUserForm.fullName.trim(),
          email: newUserForm.email.trim().toLowerCase(),
          role: newUserForm.role,
          schoolId: targetSchoolId,
          schoolName: newUserForm.role === "super_admin" ? "All Schools (Platform Owner)" : (schoolObj?.name ?? "Assigned School Workspace"),
          password: newUserForm.password || "StaffPass#2026",
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(res.message);
      setCreateUserOpen(false);
      // Only show a login slip when the password on it is really the account's password.
      if (res.user && res.initialPassword) {
        setCreatedCreds({
          user: res.user,
          password: res.initialPassword,
        });
      }
      setNewUserForm({
        fullName: "",
        email: "",
        role: isSuper ? "school_admin" : "teacher",
        schoolId: isSuper ? "" : (mySchoolId || ""),
        password: "StaffPass#2026",
      });
      refetchUsers();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createCodeMut = useMutation({
    mutationFn: async () => {
      const schoolObj = schools?.find((s) => s.id === newCodeForm.schoolId);
      if (!schoolObj) throw new Error("Please select an authorized school");
      return createCodeFn({
        data: {
          schoolId: newCodeForm.schoolId,
          schoolName: schoolObj.name,
          targetRole: newCodeForm.targetRole,
          isSingleUse: newCodeForm.isSingleUse,
          maxUses: newCodeForm.isSingleUse ? 1 : Number(newCodeForm.maxUses),
          notes: newCodeForm.notes,
          expiresInDays: Number(newCodeForm.expiresInDays) || 30,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Registration code created: ${res.code.code}`);
      setCreateCodeOpen(false);
      setCodeSuccessDialog(res.code);
      setNewCodeForm({
        schoolId: "",
        targetRole: "school_admin",
        isSingleUse: true,
        maxUses: 1,
        notes: "",
        expiresInDays: 30,
      });
      refetchCodes();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeCodeMut = useMutation({
    mutationFn: async (codeId: string) => {
      return revokeCodeFn({ data: { codeId } });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      refetchCodes();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtered users list
  const usersList = (usersData?.users ?? []).filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesSchool = schoolFilter === "all" || u.schoolId === schoolFilter;
    return matchesSearch && matchesRole && matchesSchool;
  });

  // Access validation: Only Super Admin and School Admin can access
  if (!isSuper && !isSchoolAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Role-based access control restricts the user registry to authorized Platform Super Administrators and School Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles & Users Management</h1>
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
              {isSuper ? "Super Admin Oversight" : "School Staff Directory"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuper
              ? "Platform owner controls: Assign roles, manage registration codes, configure permissions, and monitor accounts."
              : "View authorized teachers and staff members assigned strictly to your school workspace."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchUsers();
              if (isSuper) refetchCodes();
              toast.success("Registry refreshed.");
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>

          {/* Both Super Admin and School Admin can provision credentials */}
          <Button
            size="sm"
            className="font-semibold shadow-sm"
            onClick={() => {
              const defaultSchool = mySchoolId || schools?.[0]?.id || "";
              if (isSuper) {
                setNewUserForm((prev) => ({
                  ...prev,
                  schoolId: prev.schoolId || defaultSchool,
                  role: "school_admin",
                }));
              } else {
                setNewUserForm((prev) => ({
                  ...prev,
                  schoolId: defaultSchool,
                  role: "teacher",
                }));
              }
              setCreateUserOpen(true);
            }}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            {isSuper ? "Add User Credentials" : "Create Staff / Student Login"}
          </Button>

          {isSuper && (
            <Button
              size="sm"
              variant="outline"
              className="font-semibold shadow-sm border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => {
                if (schools?.length) setNewCodeForm((prev) => ({ ...prev, schoolId: schools[0].id }));
                setCreateCodeOpen(true);
              }}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              School Codes
            </Button>
          )}
        </div>
      </div>

      {/* Role Overview Summary Banner */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {((isSuper
          ? ["super_admin", "school_admin", "form_master", "teacher", "accountant"]
          : ["school_admin", "form_master", "teacher", "accountant", "student"]
        ) as AppRole[]).map((rKey) => {
          const cfg = ROLE_CONFIG[rKey];
          const Icon = cfg.icon;
          const count = (usersData?.users ?? []).filter((u) => u.role === rKey).length;
          return (
            <Card key={rKey} className="border border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cfg.label}
                  </span>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{cfg.description}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <StaffAccessRegistry />
      {/* Main Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-3">
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users & Roles ({usersList.length})
          </TabsTrigger>
          {isSuper && (
            <TabsTrigger value="codes">
              <KeyRound className="mr-2 h-4 w-4" />
              School Registration Codes ({codesData?.codes?.length ?? 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="matrix">
            <ShieldCheck className="mr-2 h-4 w-4" />
            RBAC Access Matrix
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Users Registry */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Authorized Platform Users</CardTitle>
                  <CardDescription>
                    {isSuper
                      ? "Manage role assignments, activate/deactivate accounts, and safely delete accounts."
                      : "Staff members assigned to your school workspace."}
                  </CardDescription>
                </div>
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name or email…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </div>

                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-36 text-xs">
                      <SelectValue placeholder="Filter role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {isSuper && <SelectItem value="super_admin">Super Admin</SelectItem>}
                      <SelectItem value="school_admin">School Admin</SelectItem>
                      <SelectItem value="form_master">Form Master (Class Teacher)</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>

                  {isSuper && (
                    <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                      <SelectTrigger className="w-44 text-xs">
                        <SelectValue placeholder="Filter school" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Schools</SelectItem>
                        {schools?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Details</TableHead>
                      <TableHead>Assigned Role</TableHead>
                      <TableHead>School Affiliation</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Registered</TableHead>
                      {(isSuper || isSchoolAdmin) && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Loading user directory…
                        </TableCell>
                      </TableRow>
                    ) : usersList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No users found matching current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      usersList.map((u) => {
                        const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.student;
                        const isPermanent = u.email.toLowerCase() === "mustydawuddaura@gmail.com" || u.isPermanentSuperAdmin;
                        return (
                          <TableRow key={u.userId} className={u.status !== "active" ? "opacity-75 bg-muted/20" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                                  {u.fullName.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                                    <span>{u.fullName}</span>
                                    {isPermanent && (
                                      <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        Platform Owner
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeClass}`}>
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[200px]">{u.schoolName}</span>
                              </div>
                            </TableCell>

                            <TableCell>
                              {u.status === "active" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              ) : u.status === "suspended" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                                  Suspended
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                                  Deactivated
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString("en-NG", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>

                            {(isSuper || isSchoolAdmin) && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit Staff / Teacher Profile Details */}
                                  <RegisteredDetailsEditor
                                    kind="profile"
                                    id={u.userId}
                                    name={u.fullName}
                                    schoolId={u.schoolId}
                                  />

                                  {/* Change Role Button (Super Admin only) */}
                                  {isSuper && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs font-medium"
                                      onClick={() => {
                                        setRoleModalUser(u);
                                        setSelectedRole(u.role);
                                        setSelectedSchoolId(u.schoolId ?? "");
                                      }}
                                    >
                                      <UserCog className="mr-1 h-3.5 w-3.5" />
                                      Assign Role
                                    </Button>
                                  )}

                                  {/* Deactivate / Reactivate Toggle */}
                                  {!isPermanent &&
                                    (isSuper ||
                                      (isSchoolAdmin &&
                                        u.schoolId === mySchoolId &&
                                        u.role !== "super_admin" &&
                                        u.role !== "school_admin")) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 text-xs ${u.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                        onClick={() => {
                                          const newStatus = u.status === "active" ? "deactivated" : "active";
                                          toggleStatusMut.mutate({ userId: u.userId, newStatus });
                                        }}
                                      >
                                        {u.status === "active" ? (
                                          <>
                                            <UserX className="mr-1 h-3.5 w-3.5" />
                                            Deactivate
                                          </>
                                        ) : (
                                          <>
                                            <UserCheck2 className="mr-1 h-3.5 w-3.5" />
                                            Reactivate
                                          </>
                                        )}
                                      </Button>
                                    )}

                                  {/* Delete User Button (Super Admin only) */}
                                  {isSuper && !isPermanent && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setDeleteModalUser(u);
                                        setDeleteConfirmText("");
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Registration Codes Manager (Super Admin Only) */}
        {isSuper && (
          <TabsContent value="codes" className="space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">School Registration Codes</CardTitle>
                  <CardDescription>
                    Generate unique onboarding codes linked to specific schools. Provide code to authorized school administrators or staff to register.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (schools?.length) setNewCodeForm((prev) => ({ ...prev, schoolId: schools[0].id }));
                    setCreateCodeOpen(true);
                  }}
                >
                  <KeyRound className="mr-1.5 h-4 w-4" />
                  Generate Code
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registration Code</TableHead>
                        <TableHead>Target School</TableHead>
                        <TableHead>Role Granted</TableHead>
                        <TableHead>Usage Type</TableHead>
                        <TableHead>Used Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codesLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            Loading registration codes…
                          </TableCell>
                        </TableRow>
                      ) : (codesData?.codes?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            No registration codes generated yet. Click "Generate Code" above.
                          </TableCell>
                        </TableRow>
                      ) : (
                        codesData?.codes?.map((codeItem: RegistrationCode) => {
                          const targetCfg = ROLE_CONFIG[codeItem.targetRole] || ROLE_CONFIG.school_admin;
                          return (
                            <TableRow key={codeItem.id} className={codeItem.status !== "active" ? "opacity-70 bg-muted/10" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <code className="font-mono text-xs font-bold px-2 py-1 bg-muted rounded border border-border">
                                    {codeItem.code}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Copy Code"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(codeItem.code);
                                      toast.success(`Copied registration code: ${codeItem.code}`);
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </div>
                                {codeItem.notes && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
                                    {codeItem.notes}
                                  </p>
                                )}
                              </TableCell>

                              <TableCell>
                                <span className="font-medium text-xs text-foreground">{codeItem.schoolName}</span>
                              </TableCell>

                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${targetCfg.badgeClass}`}>
                                  {targetCfg.label}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <span className="text-xs">
                                  {codeItem.isSingleUse ? (
                                    <span className="text-purple-600 font-medium">Single-Use (1 Admin)</span>
                                  ) : (
                                    <span className="text-blue-600 font-medium">Reusable (Max {codeItem.maxUses})</span>
                                  )}
                                </span>
                              </TableCell>

                              <TableCell>
                                <div className="text-xs font-semibold">
                                  {codeItem.usedCount} / {codeItem.maxUses}
                                  {codeItem.usedBy?.length > 0 && (
                                    <span className="block text-[10px] text-muted-foreground font-normal">
                                      {codeItem.usedBy[0].email}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                {codeItem.status === "active" ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                                    Active
                                  </Badge>
                                ) : codeItem.status === "expired" ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Used / Expired
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Revoked
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(codeItem.createdAt).toLocaleDateString("en-NG", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </TableCell>

                              <TableCell className="text-right">
                                {codeItem.status === "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => revokeCodeMut.mutate(codeItem.id)}
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 3: Strict RBAC Access Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Role-Based Access Control (RBAC) Governance Matrix</CardTitle>
              <CardDescription>
                Strict authorization policy enforced across server functions, database queries, and client navigation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Platform Feature / Operation</TableHead>
                      <TableHead className="text-center font-bold text-purple-700 dark:text-purple-300">Super Admin</TableHead>
                      <TableHead className="text-center font-bold text-blue-700 dark:text-blue-300">School Administrator</TableHead>
                      <TableHead className="text-center font-bold text-emerald-700 dark:text-emerald-300">Teacher</TableHead>
                      <TableHead className="text-center font-bold text-amber-700 dark:text-amber-300">Accountant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { feature: "View all schools & cross-school navigation", super: true, admin: false, tch: false, acc: false },
                      { feature: "Create new schools & platform-wide settings", super: true, admin: false, tch: false, acc: false },
                      { feature: "Manage assigned school operations & staff", super: true, admin: true, tch: "Limited", acc: "Finance scope" },
                      { feature: "Manage students registry & profile data", super: "All schools", admin: "Assigned school", tch: "Assigned classes", acc: "Fees only" },
                      { feature: "Manage teachers & staff directory", super: "All schools", admin: "Assigned school", tch: false, acc: false },
                      { feature: "Enter examination scores & marksheet", super: "As needed", admin: "If authorized", tch: "Assigned classes", acc: false },
                      { feature: "Manage school fees, invoices & payments", super: "All schools", admin: "If authorized", tch: false, acc: "Assigned school" },
                      { feature: "View platform-wide activity reports", super: true, admin: false, tch: false, acc: false },
                      { feature: "View assigned-school academic & financial reports", super: true, admin: true, tch: "Limited", acc: "Financial reports" },
                      { feature: "Create & manage school registration codes", super: true, admin: false, tch: false, acc: false },
                      { feature: "Assign, modify, or revoke user roles", super: true, admin: false, tch: false, acc: false },
                      { feature: "Delete user accounts with confirmation guard", super: true, admin: false, tch: false, acc: false },
                      { feature: "Access another school's confidential data", super: false, admin: false, tch: false, acc: false },
                    ].map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs text-foreground">{row.feature}</TableCell>
                        <TableCell className="text-center">
                          {row.super === true ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block font-bold" />
                          ) : row.super === false ? (
                            <XCircle className="h-4 w-4 text-muted-foreground/50 inline-block" />
                          ) : (
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{row.super}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.admin === true ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block font-bold" />
                          ) : row.admin === false ? (
                            <XCircle className="h-4 w-4 text-muted-foreground/50 inline-block" />
                          ) : (
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{row.admin}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.tch === true ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block font-bold" />
                          ) : row.tch === false ? (
                            <XCircle className="h-4 w-4 text-muted-foreground/50 inline-block" />
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{row.tch}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.acc === true ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block font-bold" />
                          ) : row.acc === false ? (
                            <XCircle className="h-4 w-4 text-muted-foreground/50 inline-block" />
                          ) : (
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{row.acc}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Assign / Change Role (Super Admin Only) */}
      <Dialog open={Boolean(roleModalUser)} onOpenChange={(open) => !open && setRoleModalUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign or Modify User Role</DialogTitle>
            <DialogDescription>
              Assign an authorized operational role to {roleModalUser?.fullName} ({roleModalUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role_select">Select Role</Label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as AppRole)}>
                <SelectTrigger id="role_select">
                  <SelectValue placeholder="Choose role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin (Platform Owner)</SelectItem>
                  <SelectItem value="school_admin">School Administrator</SelectItem>
                  <SelectItem value="form_master">Form Master (Class Teacher)</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_CONFIG[selectedRole]?.description}
              </p>
            </div>

            {selectedRole !== "super_admin" && (
              <div className="space-y-2">
                <Label htmlFor="school_select">Assigned School Workspace</Label>
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger id="school_select">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The user will be strictly isolated to access only records belonging to this school.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={assignRoleMut.isPending || (selectedRole !== "super_admin" && !selectedSchoolId)}
              onClick={() => assignRoleMut.mutate()}
            >
              {assignRoleMut.isPending ? "Updating Role…" : "Save Role Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Delete User Account Confirmation Guard */}
      <Dialog open={Boolean(deleteModalUser)} onOpenChange={(open) => !open && setDeleteModalUser(null)}>
        <DialogContent className="sm:max-w-md border-destructive/30">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-destructive">Confirm Role Removal</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to remove the account for <strong>{deleteModalUser?.fullName}</strong> ({deleteModalUser?.email})?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-md bg-destructive/10 p-3 text-destructive border border-destructive/20 space-y-1">
              <p className="font-semibold">Important Safety Guarantee:</p>
              <p>
                Removing assigned roles revokes school permissions but preserves the sign-in account. School records, student data, grades, and financial audit logs will <strong>NOT</strong> be deleted.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="del_conf">
                Type <strong className="text-destructive">DELETE</strong> to confirm:
              </Label>
              <Input
                id="del_conf"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE" || deleteUserMut.isPending}
              onClick={() => deleteUserMut.mutate()}
            >
              {deleteUserMut.isPending ? "Removing User…" : "Confirm Role Removal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Generate Registration Code (Super Admin Only) */}
      <Dialog open={createCodeOpen} onOpenChange={setCreateCodeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <DialogTitle>Generate School Registration Code</DialogTitle>
            </div>
            <DialogDescription>
              Create a unique registration code for a specific school. Authorized administrators or staff will enter this code during signup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="reg_school">Select School</Label>
              <Select
                value={newCodeForm.schoolId}
                onValueChange={(val) => setNewCodeForm((p) => ({ ...p, schoolId: val }))}
              >
                <SelectTrigger id="reg_school">
                  <SelectValue placeholder="Choose school" />
                </SelectTrigger>
                <SelectContent>
                  {schools?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg_role">Role to Grant Upon Registration</Label>
              <Select
                value={newCodeForm.targetRole}
                onValueChange={(val: any) => setNewCodeForm((p) => ({ ...p, targetRole: val }))}
              >
                <SelectTrigger id="reg_role">
                  <SelectValue placeholder="Target Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school_admin">School Administrator</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant / Bursar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Registration codes can never grant Super Admin privileges.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg_type">Usage Type</Label>
                <Select
                  value={newCodeForm.isSingleUse ? "single" : "multi"}
                  onValueChange={(val) => setNewCodeForm((p) => ({ ...p, isSingleUse: val === "single" }))}
                >
                  <SelectTrigger id="reg_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single-Use (1 Account)</SelectItem>
                    <SelectItem value="multi">Reusable (Multiple Accounts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!newCodeForm.isSingleUse && (
                <div className="space-y-1.5">
                  <Label htmlFor="reg_max">Max Users Allowed</Label>
                  <Input
                    id="reg_max"
                    type="number"
                    min={2}
                    max={500}
                    value={newCodeForm.maxUses}
                    onChange={(e) => setNewCodeForm((p) => ({ ...p, maxUses: Number(e.target.value) }))}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg_notes">Internal Description / Notes</Label>
              <Input
                id="reg_notes"
                placeholder="e.g. Issued for Principal Aliyu Lawal onboarding"
                value={newCodeForm.notes}
                onChange={(e) => setNewCodeForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCodeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createCodeMut.isPending || !newCodeForm.schoolId}
              onClick={() => createCodeMut.mutate()}
            >
              {createCodeMut.isPending ? "Generating…" : "Generate & Authorize Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Create Login Credentials (Super Admin or School Admin) */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <DialogTitle>
                {isSuper
                  ? "Create School Administrator / User Credentials"
                  : "Create Staff or Student Login Credentials"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {isSuper
                ? "Provision login credentials for School Administrators or authorized platform users."
                : "Create login credentials for teachers, form masters, accountants, and registered students in your school."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="usr_fullname">Full Name</Label>
              <Input
                id="usr_fullname"
                placeholder={isSuper ? "e.g. Mujittaba Salisu (Principal)" : "e.g. Ustaz Aliyu Bello"}
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr_email">Email Address (Login Username)</Label>
              <Input
                id="usr_email"
                type="email"
                placeholder="e.g. staff@school.edu.ng"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr_role">Assigned Platform Role</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(val: any) => setNewUserForm((p) => ({ ...p, role: val }))}
              >
                <SelectTrigger id="usr_role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {isSuper && (
                    <SelectItem value="school_admin">
                      School Administrator (Principal / Head of School)
                    </SelectItem>
                  )}
                  <SelectItem value="form_master">
                    Form Master (Class Teacher / Broadsheet)
                  </SelectItem>
                  <SelectItem value="teacher">
                    Teacher (Subject Teacher / Exam Records)
                  </SelectItem>
                  <SelectItem value="accountant">
                    Accountant / Bursar (Fees & Accounts)
                  </SelectItem>
                  <SelectItem value="student">
                    Student (Academic Registration & Portal)
                  </SelectItem>
                  <SelectItem value="parent">
                    Parent / Guardian
                  </SelectItem>
                  {isSuper && (
                    <SelectItem value="super_admin">
                      Super Admin (Platform Owner)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* School Workspace Selection or School Lock */}
            {isSuper ? (
              newUserForm.role !== "super_admin" && (
                <div className="space-y-1.5">
                  <Label htmlFor="usr_school">Assigned School Workspace</Label>
                  <Select
                    value={newUserForm.schoolId}
                    onValueChange={(val) => setNewUserForm((p) => ({ ...p, schoolId: val }))}
                  >
                    <SelectTrigger id="usr_school">
                      <SelectValue placeholder="Choose school workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            ) : (
              <div className="space-y-1.5">
                <Label>Assigned School Workspace</Label>
                <div className="rounded-md border border-border/80 bg-muted/60 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      {schools?.find((s) => s.id === (newUserForm.schoolId || mySchoolId || schools?.[0]?.id))?.name || schools?.[0]?.name || "Assigned School Workspace"}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
                    Locked to Your School
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Credentials are strictly bound to this school workspace.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="usr_pass">Initial Password</Label>
              <Input
                id="usr_pass"
                type="password"
                placeholder="StaffPass#2026"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                The user can sign in immediately using this email and password on the Staff & Admin sign in tab.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createUserMut.isPending ||
                !newUserForm.fullName.trim() ||
                !newUserForm.email.trim() ||
                (isSuper && newUserForm.role !== "super_admin" && !newUserForm.schoolId)
              }
              onClick={() => createUserMut.mutate()}
            >
              {createUserMut.isPending ? "Creating Credentials…" : "Create Login Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Registration Code Created Success Dialog */}
      <Dialog
        open={Boolean(codeSuccessDialog)}
        onOpenChange={(open) => !open && setCodeSuccessDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <DialogTitle className="text-lg">Registration Code Ready</DialogTitle>
            </div>
            <DialogDescription>
              Share this unique code with the authorized school administrator or staff member.
            </DialogDescription>
          </DialogHeader>

          {codeSuccessDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-4 text-center border border-border">
                <span className="text-xs uppercase font-medium tracking-wider text-muted-foreground block mb-1">
                  School Registration Code
                </span>
                <div className="text-2xl font-mono font-extrabold tracking-wider text-primary select-all">
                  {codeSuccessDialog.code}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Linked to: <strong>{codeSuccessDialog.schoolName}</strong>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Role Assigned:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {codeSuccessDialog.targetRole.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Usage:</span>
                  <span className="font-semibold text-foreground">
                    {codeSuccessDialog.isSingleUse ? "Single-use only" : `Reusable (up to ${codeSuccessDialog.maxUses} users)`}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Expires:</span>
                  <span className="font-semibold text-foreground">
                    {codeSuccessDialog.expiresAt ? new Date(codeSuccessDialog.expiresAt).toLocaleDateString() : "No expiry"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (codeSuccessDialog?.code) {
                  navigator.clipboard.writeText(codeSuccessDialog.code);
                  toast.success("Code copied to clipboard!");
                }
                setCodeSuccessDialog(null);
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copy Code & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Staff Login Credentials Slip Dialog */}
      <Dialog
        open={Boolean(createdCreds)}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCreds(null);
            setShowCreatedPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <DialogTitle className="text-lg">Staff Login Credentials Created</DialogTitle>
            </div>
            <DialogDescription>
              The user account is active and ready for immediate login on the school portal.
            </DialogDescription>
          </DialogHeader>

          {createdCreds && (
            <div className="space-y-4 py-2">
              {/* Slip Card */}
              <div className="rounded-xl border border-primary/20 bg-muted/40 p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-xs text-foreground truncate max-w-[240px]">
                      {createdCreds.user.schoolName || "Assigned School Workspace"}
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-semibold border ${ROLE_CONFIG[createdCreds.user.role]?.badgeClass || ""}`}>
                    {ROLE_CONFIG[createdCreds.user.role]?.label || createdCreds.user.role}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block font-medium">Full Name</span>
                    <span className="text-sm font-bold text-foreground">{createdCreds.user.fullName}</span>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        Login Email / Username
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground select-all">
                        {createdCreds.user.email}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCreds.user.email);
                        toast.success("Email copied to clipboard!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        Initial Password
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground select-all">
                        {showCreatedPassword ? createdCreds.password : "••••••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      >
                        {showCreatedPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(createdCreds.password || "");
                          toast.success("Password copied to clipboard!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-primary mb-0.5">
                    <Check className="h-3.5 w-3.5" />
                    Sign-in Instructions
                  </div>
                  Direct this staff member to sign in on the school portal via the <strong>Staff & Admin</strong> tab.
                </div>
              </div>

              {/* Copy Full Slip Button */}
              <Button
                variant="outline"
                className="w-full text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => {
                  const roleLabel = ROLE_CONFIG[createdCreds.user.role]?.label || createdCreds.user.role;
                  const loginUrl = `${window.location.origin}/auth`;
                  const slipText = `🏫 ${createdCreds.user.schoolName || "Alegacy School Platform"}\n👤 Staff Name: ${createdCreds.user.fullName}\n🏷️ Assigned Role: ${roleLabel}\n📧 Login Email: ${createdCreds.user.email}\n🔑 Initial Password: ${createdCreds.password}\n🌐 Portal Sign In: ${loginUrl}\n👉 Note: Sign in using the "Staff & Admin" tab.`;
                  navigator.clipboard.writeText(slipText);
                  toast.success("Full credentials slip copied for WhatsApp or SMS!");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Full Credentials Slip (WhatsApp / SMS Format)
              </Button>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setCreatedCreds(null);
                setShowCreatedPassword(false);
                setCreateUserOpen(true);
              }}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Add Another User
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setCreatedCreds(null);
                setShowCreatedPassword(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
