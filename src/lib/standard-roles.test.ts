import { describe, it, expect } from "vitest";
import { STANDARD_SCHOOL_ROLES, customRoleGrants, isSafePreset, missingStandardRoles } from "./standard-roles";
import { DEPARTMENTS, canOpenDepartment, canOpenLink } from "./departments";

describe("standard school roles", () => {
  it("offers Principal, Academic Coordinator/HOD and HR Officer", () => {
    expect(STANDARD_SCHOOL_ROLES.map((r) => r.name)).toEqual(["Principal / Headteacher", "Academic Coordinator / HOD", "HR Officer"]);
  });

  it("never grants admin-only powers or finance", () => {
    for (const r of STANDARD_SCHOOL_ROLES) {
      expect(isSafePreset(r.permissions)).toBe(true);
      expect(r.permissions.some((p) => p.startsWith("fees."))).toBe(false);
    }
  });

  it("only the principal may approve results; HR cannot approve payroll", () => {
    const by = (n: string) => STANDARD_SCHOOL_ROLES.find((r) => r.name.startsWith(n))!.permissions;
    expect(by("Principal")).toContain("results.publish");
    expect(by("Academic")).not.toContain("results.publish");
    expect(by("HR")).not.toContain("payroll.approve");
  });

  it("skips roles the school already has, ignoring case and spaces", () => {
    expect(missingStandardRoles(["hr  officer"]).map((r) => r.name)).toEqual(["Principal / Headteacher", "Academic Coordinator / HOD"]);
  });

  it("ignores inactive assignments and inactive roles", () => {
    const grants = customRoleGrants([
      { active: true, school_custom_roles: { active: true, permissions: ["staffatt.view"] } },
      { active: false, school_custom_roles: { active: true, permissions: ["payroll.view"] } },
      { active: true, school_custom_roles: { active: false, permissions: ["results.publish"] } },
    ]);
    expect(grants).toEqual(["staffatt.view"]);
  });

  it("lets an HR Officer open Human Resources but only the staff attendance page", () => {
    const hr = DEPARTMENTS.find((d) => d.slug === "human-resources")!;
    const granted = ["staffatt.view", "staffatt.edit", "payroll.view", "payroll.edit"] as const;
    const access = { roles: ["teacher"], can: (p: string) => (granted as readonly string[]).includes(p), granted };
    expect(canOpenDepartment(hr, access)).toBe(true);
    expect(hr.links.filter((l) => canOpenLink(l, access)).map((l) => l.to)).toEqual(["/staff-attendance"]);
    const finance = DEPARTMENTS.find((d) => d.slug === "finance")!;
    expect(canOpenDepartment(finance, access)).toBe(false);
  });
});
