import { describe, it, expect } from "vitest";
import { DEPARTMENTS, canOpenLink, canOpenDepartment, summarizeAttendance, visibleDepartments } from "./departments";

describe("departmental dashboard", () => {
  it("has the 15 departments from the brief, each with a unique page", () => {
    expect(DEPARTMENTS).toHaveLength(15);
    expect(new Set(DEPARTMENTS.map((d) => d.slug)).size).toBe(15);
  });

  it("keeps teachers out of finance and HR", () => {
    const teacher = { roles: ["teacher"], can: () => true };
    const hr = DEPARTMENTS.find((d) => d.slug === "human-resources")!;
    const finance = DEPARTMENTS.find((d) => d.slug === "finance")!;
    expect(canOpenDepartment(hr, teacher)).toBe(false);
    expect(canOpenDepartment(finance, teacher)).toBe(false);
    expect(visibleDepartments(teacher).some((d) => d.slug === "academic-affairs")).toBe(true);
  });

  it("hides a link when the school has not granted its permission", () => {
    const link = DEPARTMENTS.find((d) => d.slug === "finance")!.links[0]!;
    expect(canOpenLink(link, { roles: ["accountant"], can: () => false })).toBe(false);
    expect(canOpenLink(link, { roles: ["accountant"], can: () => true })).toBe(true);
    expect(canOpenLink(link, { roles: ["super_admin"], can: () => false })).toBe(true);
  });

  it("counts late as present and never treats unmarked pupils as absent", () => {
    const gender: Record<string, string> = { a: "male", b: "male", c: "female", d: "female" };
    const s = summarizeAttendance(
      [{ student_id: "a", status: "present" }, { student_id: "b", status: "absent" }, { student_id: "c", status: "late" }],
      (id) => gender[id],
    );
    expect(s.marked).toBe(3);
    expect(s.absent).toBe(1);
    expect(s.rate).toBe(66.7);
    expect(s.boys.rate).toBe(50);
    expect(s.girls.rate).toBe(100);
    expect(summarizeAttendance([], () => null).rate).toBeNull();
  });
});
