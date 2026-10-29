import test from "node:test";
import assert from "node:assert/strict";
import { mockPostgrestFetch } from "../integrations/supabase/mockDatabase";

for (const [name, path, method] of [
  ["sign-in cannot fabricate an admin", "/auth/v1/token", "POST"],
  ["school writes cannot pretend to save", "/rest/v1/schools", "POST"],
  ["student writes cannot pretend to save", "/rest/v1/students", "POST"],
  ["permission checks cannot grant offline access", "/rest/v1/rpc/school_permission", "POST"],
] as const) {
  test(name, async () => {
    const res = await mockPostgrestFetch(`https://placeholder.supabase.co${path}`, { method });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "BACKEND_NOT_CONFIGURED");
  });
}

test("a populated school write cannot report a pretend save", async () => {
  const res = await mockPostgrestFetch("https://example.invalid/rest/v1/schools", {
    method: "POST", body: JSON.stringify({ name: "Test School", code: "TEST-001" }),
  });
  assert.equal(res.status, 503);
});
