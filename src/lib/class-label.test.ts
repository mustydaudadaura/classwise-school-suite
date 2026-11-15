import { describe, expect, it } from "vitest";
import { classDisplayName } from "./class-label";

describe("classDisplayName", () => {
  it("does not repeat an arm already in the class name", () => {
    expect(classDisplayName({ name: "Primary 2 A", arm: "A" })).toBe("Primary 2 A");
  });
  it("adds the arm when the name lacks it", () => {
    expect(classDisplayName({ name: "JSS 1", arm: "B" })).toBe("JSS 1 B");
  });
  it("keeps names without an arm", () => {
    expect(classDisplayName({ name: "Nursery 3", arm: null })).toBe("Nursery 3");
  });
});
