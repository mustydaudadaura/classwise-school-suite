import type { SchoolPermission } from "@/lib/school-access";

/** Pages that already exist in the app and can be opened from a department. */
export type DepartmentPath =
  | "/students" | "/admissions" | "/promotion" | "/id-cards" | "/documents"
  | "/staff" | "/users" | "/staff-attendance" | "/classes" | "/academics"
  | "/results" | "/term-records" | "/report-cards" | "/report-distribution"
  | "/scratch-cards" | "/fees" | "/attendance" | "/kiosk" | "/announcements" | "/islamic";

export type StaffRole = "super_admin" | "school_admin" | "teacher" | "accountant";

export interface DepartmentLink {
  label: string;
  description: string;
  to: DepartmentPath;
  permission?: SchoolPermission;
  roles: readonly StaffRole[];
}

export type HubStatKey = "students" | "staff" | "attendanceToday" | "pendingSubmissions" | "boys" | "girls";

export interface Department {
  slug: string;
  title: string;
  short: string;
  description: string;
  /** CSS colour token used for the icon and tile tint. */
  color: string;
  links: DepartmentLink[];
  /** Agreed features not built yet, with the roadmap phase that adds them. */
  planned: { label: string; phase: number }[];
  stats: HubStatKey[];
  /** Who may open the department page at all. */
  roles: readonly StaffRole[];
}

const ADMIN: readonly StaffRole[] = ["super_admin", "school_admin"];
const ACADEMIC: readonly StaffRole[] = ["super_admin", "school_admin", "teacher"];
const ALL_STAFF: readonly StaffRole[] = ["super_admin", "school_admin", "teacher", "accountant"];
const FINANCE: readonly StaffRole[] = ["super_admin", "school_admin", "accountant"];

export const DEPARTMENTS: Department[] = [
  {
    slug: "student-affairs", title: "Student Affairs & Administration", short: "Student Affairs",
    description: "Admissions, student records, promotion, ID cards and certificates.",
    color: "var(--dept-blue)", roles: ACADEMIC, stats: ["students", "boys", "girls"],
    links: [
      { label: "Students", description: "Central student records and biodata", to: "/students", permission: "students.view", roles: ACADEMIC },
      { label: "Admissions", description: "New admissions and activation", to: "/admissions", permission: "students.view", roles: ADMIN },
      { label: "Promotion", description: "Move pupils to the next session", to: "/promotion", permission: "promotion.edit", roles: ADMIN },
      { label: "ID Cards", description: "Student and staff ID cards", to: "/id-cards", permission: "students.view", roles: ADMIN },
      { label: "Certificates & Reports", description: "Certificates and yearly reports", to: "/documents", permission: "students.view", roles: ADMIN },
    ],
    planned: [{ label: "Transfer, withdrawal and movement records", phase: 7 }, { label: "Discipline and counselling records", phase: 7 }],
  },
  {
    slug: "human-resources", title: "Human Resources & Staff Management", short: "Human Resources",
    description: "Staff register, logins, attendance, leave and payroll.",
    color: "var(--dept-indigo)", roles: ADMIN, stats: ["staff"],
    links: [
      { label: "Staff Register", description: "Every staff member and their details", to: "/staff", permission: "users.edit", roles: ADMIN },
      { label: "Staff & User Credentials", description: "Portal logins and roles", to: "/users", permission: "users.edit", roles: ADMIN },
      { label: "Staff Attendance, Leave & Payroll", description: "Clock-in records, leave and salaries", to: "/staff-attendance", permission: "staffatt.view", roles: ADMIN },
    ],
    planned: [{ label: "Appraisal, training and promotion records", phase: 7 }, { label: "Queries, disciplinary and handover records", phase: 7 }],
  },
  {
    slug: "academic-affairs", title: "Academic Affairs", short: "Academic Affairs",
    description: "Classes, subjects, timetable, lesson notes, results and report cards.",
    color: "var(--dept-emerald)", roles: ACADEMIC, stats: ["pendingSubmissions"],
    links: [
      { label: "Classes & Subjects", description: "Classes, subjects and allocations", to: "/classes", permission: "academics.view", roles: ACADEMIC },
      { label: "Teaching & Timetable", description: "Timetable, scheme of work and lesson notes", to: "/academics", permission: "academics.view", roles: ACADEMIC },
      { label: "Results Entry", description: "Continuous assessment and exam scores", to: "/results", permission: "results.edit", roles: ACADEMIC },
      { label: "Term Records", description: "Days present and skill ratings", to: "/term-records", roles: ACADEMIC },
      { label: "Report Cards", description: "Generate and view report cards", to: "/report-cards", permission: "results.view", roles: ACADEMIC },
      { label: "Report PDFs & WhatsApp", description: "Download and share report cards", to: "/report-distribution", permission: "results.view", roles: ACADEMIC },
    ],
    planned: [{ label: "Weekly Record of Work (teacher free-text)", phase: 4 }, { label: "Lesson delivery and curriculum coverage", phase: 4 }],
  },
  {
    slug: "finance", title: "Finance & Accounts", short: "Finance & Accounts",
    description: "Fees, invoices, payments, receipts and expenses.",
    color: "var(--dept-amber)", roles: FINANCE, stats: [],
    links: [
      { label: "Fees & Finances", description: "Invoices, payments, receipts and expenses", to: "/fees", permission: "fees.view", roles: FINANCE },
      { label: "Result Scratch Cards", description: "Sell and track result-checking cards", to: "/scratch-cards", permission: "settings.edit", roles: ADMIN },
    ],
    planned: [{ label: "Cashbook, payment vouchers and budgets", phase: 7 }, { label: "PTA contributions and audit records", phase: 7 }],
  },
  {
    slug: "attendance", title: "Student Attendance Management", short: "Attendance Management",
    description: "Daily class registers and attendance summaries.",
    color: "var(--dept-teal)", roles: ACADEMIC, stats: ["attendanceToday", "boys", "girls"],
    links: [
      { label: "Student Attendance", description: "Mark the daily class register", to: "/attendance", permission: "attendance.view", roles: ACADEMIC },
      { label: "Staff Attendance (separate)", description: "Staff clock-in kept apart from pupils", to: "/staff-attendance", permission: "staffatt.view", roles: ALL_STAFF },
      { label: "Attendance Kiosk", description: "Staff PIN kiosk", to: "/kiosk", permission: "staffatt.kiosk", roles: ADMIN },
    ],
    planned: [{ label: "Weekly, monthly and termly register reports (boys/girls)", phase: 3 }, { label: "School calendar, QR ID cards and QR scanning", phase: 3 }],
  },
  {
    slug: "submissions", title: "Submissions & School Records", short: "Submissions & School Records",
    description: "Records teachers submit for review and approval.",
    color: "var(--dept-violet)", roles: ACADEMIC, stats: ["pendingSubmissions"],
    links: [
      { label: "Lesson Notes & Scheme of Work", description: "Submit and review teaching records", to: "/academics", permission: "academics.view", roles: ACADEMIC },
      { label: "Certificates & Reports", description: "Generated school documents", to: "/documents", permission: "students.view", roles: ADMIN },
    ],
    planned: [{ label: "One central submission desk with versions and deadlines", phase: 5 }],
  },
  {
    slug: "parents-pta", title: "Parents & PTA Relations", short: "Parents & PTA",
    description: "Parent contacts, announcements and the family portal.",
    color: "var(--dept-pink)", roles: ADMIN, stats: [],
    links: [
      { label: "Announcements & Messages", description: "News and messages to parents", to: "/announcements", permission: "communication.view", roles: ADMIN },
      { label: "Students & Parent Contacts", description: "Parent details on each student record", to: "/students", permission: "students.view", roles: ADMIN },
    ],
    planned: [{ label: "PTA membership, minutes and meeting attendance", phase: 7 }, { label: "Parent complaints and feedback", phase: 7 }],
  },
  {
    slug: "security", title: "Security & Safety Management", short: "Security & Safety",
    description: "Visitors, incidents, pickups and safety checks.",
    color: "var(--dept-green)", roles: ADMIN, stats: [],
    links: [{ label: "Attendance Kiosk", description: "Staff entry and exit punches", to: "/kiosk", permission: "staffatt.kiosk", roles: ADMIN }],
    planned: [{ label: "Visitors register and pickup records", phase: 7 }, { label: "Incident, accident and safety inspection reports", phase: 7 }],
  },
  {
    slug: "facilities", title: "Facilities & Inventory Management", short: "Facilities & Inventory",
    description: "School property, equipment and maintenance.",
    color: "var(--dept-indigo)", roles: ADMIN, stats: [], links: [],
    planned: [{ label: "Property, furniture and equipment register", phase: 7 }, { label: "Maintenance requests and reports", phase: 7 }],
  },
  {
    slug: "health", title: "Health & Welfare Records", short: "Health & Welfare",
    description: "Health records with strict access.",
    color: "var(--dept-rose)", roles: ADMIN, stats: [], links: [],
    planned: [{ label: "Student health, first aid and emergencies (restricted)", phase: 7 }, { label: "Screening, immunisation and feeding records", phase: 7 }],
  },
  {
    slug: "compliance", title: "Government & Regulatory Compliance", short: "Government & Compliance",
    description: "Nominal rolls, enrolment statistics and approvals.",
    color: "var(--dept-emerald)", roles: ADMIN, stats: ["students", "boys", "girls", "staff"],
    links: [
      { label: "Student Nominal Roll", description: "Every registered student", to: "/students", permission: "students.view", roles: ADMIN },
      { label: "Staff Nominal Roll", description: "Every staff member", to: "/staff", permission: "users.edit", roles: ADMIN },
    ],
    planned: [{ label: "Approvals, census and inspection documents", phase: 7 }],
  },
  {
    slug: "programmes", title: "Programmes & School Activities", short: "Programmes & Activities",
    description: "Events, assemblies, sports and clubs.",
    color: "var(--dept-violet)", roles: ADMIN, stats: [],
    links: [{ label: "Announcements", description: "Share events with parents", to: "/announcements", permission: "communication.view", roles: ADMIN }],
    planned: [{ label: "Assembly, gazette, events and sports records", phase: 7 }],
  },
  {
    slug: "tahfiz", title: "Tahfiz & Islamic Education", short: "Tahfiz & Islamic Education",
    description: "Islamiyya programmes, Qur'an progress and reports.",
    color: "var(--dept-teal)", roles: ACADEMIC, stats: [],
    links: [{ label: "Islamic Programmes", description: "Tahfiz register, Qur'an progress and Islamiyya reports", to: "/islamic", permission: "academics.view", roles: ACADEMIC }],
    planned: [{ label: "Daily submissions, muraja'ah and tajweed records", phase: 7 }],
  },
  {
    slug: "transport", title: "Transport & Boarding Management", short: "Transport & Boarding",
    description: "Vehicles, drivers and boarding houses.",
    color: "var(--dept-blue)", roles: ADMIN, stats: [], links: [],
    planned: [{ label: "Vehicles, drivers and transport register", phase: 7 }, { label: "Boarding register and dormitory attendance", phase: 7 }],
  },
  {
    slug: "supervision", title: "Supervision & Inspection Centre", short: "Supervision & Inspection",
    description: "Find school documents quickly for inspectors.",
    color: "var(--dept-amber)", roles: ADMIN, stats: ["pendingSubmissions"],
    links: [
      { label: "Report Cards", description: "Generated report cards", to: "/report-cards", permission: "results.view", roles: ADMIN },
      { label: "Certificates & Reports", description: "School documents", to: "/documents", permission: "students.view", roles: ADMIN },
    ],
    planned: [{ label: "Filters, missing-record list, ZIP and combined PDF", phase: 6 }],
  },
];

export function findDepartment(slug: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.slug === slug);
}

type Access = {
  roles: readonly string[];
  can: (p: SchoolPermission) => boolean;
  /** Permissions handed out by the school's custom roles (Principal, HOD, HR Officer…). */
  granted?: readonly SchoolPermission[];
};

function staffRoles(roles: readonly string[]): StaffRole[] {
  return roles.filter((r): r is StaffRole => ["super_admin", "school_admin", "teacher", "accountant"].includes(r));
}

/** A custom-role grant opens a link only when the database also confirms the permission. */
function grantedLink(link: DepartmentLink, access: Access): boolean {
  return Boolean(link.permission && access.granted?.includes(link.permission) && access.can(link.permission));
}

/** Super Admin sees everything; others need the role (or a custom-role grant) and, when set, the school permission. */
export function canOpenLink(link: DepartmentLink, access: Access): boolean {
  if (access.roles.includes("super_admin")) return true;
  if (grantedLink(link, access)) return true;
  const mine = staffRoles(access.roles);
  if (!link.roles.some((r) => mine.includes(r))) return false;
  return link.permission ? access.can(link.permission) : true;
}

export function canOpenDepartment(dept: Department, access: Access): boolean {
  if (access.roles.includes("super_admin")) return true;
  const mine = staffRoles(access.roles);
  if (dept.roles.some((r) => mine.includes(r))) return true;
  return dept.links.some((l) => grantedLink(l, access));
}

export function visibleDepartments(access: Access): Department[] {
  return DEPARTMENTS.filter((d) => canOpenDepartment(d, access));
}

export interface AttendanceSummary {
  marked: number; present: number; absent: number; late: number; excused: number;
  /** Present + late, divided by pupils actually marked; unmarked pupils are never counted absent. */
  rate: number | null;
  boys: { marked: number; present: number; rate: number | null };
  girls: { marked: number; present: number; rate: number | null };
}

const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export function summarizeAttendance(
  rows: { student_id: string; status: string }[],
  genderOf: (studentId: string) => string | null | undefined,
): AttendanceSummary {
  const s = { marked: 0, present: 0, absent: 0, late: 0, excused: 0 };
  const boys = { marked: 0, present: 0 };
  const girls = { marked: 0, present: 0 };
  for (const r of rows) {
    if (!["present", "absent", "late", "excused"].includes(r.status)) continue;
    s.marked++;
    (s as Record<string, number>)[r.status]! += 1;
    const here = r.status === "present" || r.status === "late";
    const g = genderOf(r.student_id);
    const bucket = g === "male" ? boys : g === "female" ? girls : null;
    if (bucket) { bucket.marked++; if (here) bucket.present++; }
  }
  return {
    ...s,
    rate: rate(s.present + s.late, s.marked),
    boys: { ...boys, rate: rate(boys.present, boys.marked) },
    girls: { ...girls, rate: rate(girls.present, girls.marked) },
  };
}
