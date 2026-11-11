/** Shared, browser-safe validation for the Staff register form. */
export const STAFF_ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "school_admin", label: "School Administrator" },
  { value: "accountant", label: "Accountant / Bursar" },
  { value: "non_teaching", label: "Non-teaching staff" },
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number]["value"];
export const LOGIN_ROLES: StaffRole[] = ["teacher", "school_admin", "accountant"];

export type StaffForm = {
  full_name: string; phone: string; email: string; role: StaffRole;
  staff_no: string; department: string; job_title: string; photo_url: string | null;
  monthly_salary: string; bank_name: string; account_number: string; account_name: string;
  create_login: boolean; password: string;
};

export const EMPTY_STAFF: StaffForm = {
  full_name: "", phone: "", email: "", role: "teacher", staff_no: "", department: "", job_title: "",
  photo_url: null, monthly_salary: "", bank_name: "", account_number: "", account_name: "",
  create_login: false, password: "",
};

export function validateStaff(f: StaffForm, opts: { isNew: boolean; hasLogin: boolean }): string | null {
  if (f.full_name.trim().length < 2) return "Enter the staff member's full name";
  const phone = f.phone.replace(/[\s-]/g, "");
  if (!/^\+?\d{10,14}$/.test(phone)) return "Enter a valid phone number (e.g. 08012345678)";
  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  const salary = f.monthly_salary.trim() === "" ? 0 : Number(f.monthly_salary);
  if (!Number.isFinite(salary) || salary < 0) return "Salary must be zero or more";
  if (f.account_number.trim() && !/^\d{10}$/.test(f.account_number.trim())) return "Account number must be exactly 10 digits";
  if (f.create_login && !opts.hasLogin) {
    if (!LOGIN_ROLES.includes(f.role)) return "Non-teaching staff cannot get a portal login. Change the role or untick login.";
    if (!email) return "An email is needed to create a portal login";
    if (opts.isNew || f.password) { if (f.password.length < 8) return "Login password must be at least 8 characters"; }
  }
  return null;
}

export function staffRow(f: StaffForm) {
  const t = (s: string) => s.trim() || null;
  return {
    full_name: f.full_name.trim(), phone: f.phone.replace(/[\s-]/g, ""), email: t(f.email)?.toLowerCase() ?? null,
    role: f.role, staff_no: t(f.staff_no), department: t(f.department), job_title: t(f.job_title),
    photo_url: f.photo_url, monthly_salary: f.monthly_salary.trim() === "" ? 0 : Number(f.monthly_salary),
    bank_name: t(f.bank_name), account_number: t(f.account_number), account_name: t(f.account_name),
  };
}
