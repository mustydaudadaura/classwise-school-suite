import { describe, it, expect } from "vitest";
import { EMPTY_STAFF, validateStaff, staffRow } from "./staff-register";

const base = { ...EMPTY_STAFF, full_name: "Amina Bello", phone: "08012345678" };
const opts = { isNew: true, hasLogin: false };

describe("staff register validation", () => {
  it("accepts a staff record without a login", () => {
    expect(validateStaff(base, opts)).toBeNull();
  });
  it("requires a phone number", () => {
    expect(validateStaff({ ...base, phone: "" }, opts)).toMatch(/phone/);
  });
  it("requires email and 8+ character password when creating a login", () => {
    expect(validateStaff({ ...base, create_login: true }, opts)).toMatch(/email/);
    expect(validateStaff({ ...base, create_login: true, email: "a@b.com", password: "short" }, opts)).toMatch(/8 characters/);
    expect(validateStaff({ ...base, create_login: true, email: "a@b.com", password: "12345678" }, opts)).toBeNull();
  });
  it("blocks portal logins for non-teaching staff", () => {
    expect(validateStaff({ ...base, role: "non_teaching", create_login: true, email: "a@b.com", password: "12345678" }, opts)).toMatch(/Non-teaching/);
  });
  it("requires a 10-digit account number", () => {
    expect(validateStaff({ ...base, account_number: "12345" }, opts)).toMatch(/10 digits/);
    expect(validateStaff({ ...base, account_number: "0123456789" }, opts)).toBeNull();
  });
  it("stores blank salary as zero", () => {
    expect(staffRow(base).monthly_salary).toBe(0);
  });
});
