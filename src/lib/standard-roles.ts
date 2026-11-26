import type { SchoolPermission } from "@/lib/school-access";

/**
 * Ready-made school roles. They are created as ordinary custom roles, so the
 * database permission check (school_permission) enforces them like any other.
 * Settings, user management, audit history, payroll approval and fees stay
 * with school administrators / accountants.
 */
export const STANDARD_SCHOOL_ROLES: readonly { name: string; summary: string; permissions: readonly SchoolPermission[] }[] = [
  {
    name: "Principal / Headteacher",
    summary: "Oversees pupils, results approval, attendance, announcements and staff attendance",
    permissions: ["students.view", "academics.view", "results.view", "results.publish", "attendance.view", "communication.view", "communication.edit", "staffatt.view"],
  },
  {
    name: "Academic Coordinator / HOD",
    summary: "Manages classes, subjects, lesson notes and score entry",
    permissions: ["students.view", "academics.view", "academics.edit", "results.view", "results.edit", "attendance.view"],
  },
  {
    name: "HR Officer",
    summary: "Manages staff attendance and prepares payroll (approval stays with the administrator)",
    permissions: ["staffatt.view", "staffatt.edit", "payroll.view", "payroll.edit"],
  },
];

const ADMIN_ONLY: readonly string[] = ["settings.edit", "users.edit", "audit.view", "payroll.approve"];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Standard roles the school has not created yet (matched by name, case-insensitive). */
export function missingStandardRoles(existingNames: readonly string[]) {
  const have = new Set(existingNames.map(norm));
  return STANDARD_SCHOOL_ROLES.filter((r) => !have.has(norm(r.name)));
}

/** True when a preset never hands out administrator-only powers. */
export function isSafePreset(permissions: readonly string[]) {
  return permissions.every((p) => !ADMIN_ONLY.includes(p));
}

/** Permissions a user receives from their active custom-role assignments. */
export function customRoleGrants(
  assignments: readonly { active: boolean; school_custom_roles: { active: boolean; permissions: readonly string[] } | null }[],
): SchoolPermission[] {
  const out = new Set<SchoolPermission>();
  for (const a of assignments) {
    if (!a.active || !a.school_custom_roles?.active) continue;
    for (const p of a.school_custom_roles.permissions) out.add(p as SchoolPermission);
  }
  return [...out];
}
