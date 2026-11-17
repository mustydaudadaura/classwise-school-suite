import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/parent-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { phone } = (await request.json()) as { phone?: string };
          const digits = (phone || "").replace(/\D/g, "");
          if (digits.length < 7) {
            return Response.json({ error: "Enter a valid phone number" }, { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let row: any = null;
          try {
            const { data, error } = await supabaseAdmin.rpc("find_parent_by_phone", { _phone: digits });
            if (!error && data) {
              row = Array.isArray(data) ? data[0] : data;
            }
          } catch {
            // DB offline or placeholder
          }

          if (!row) {
            return Response.json({ error: "No parent found for that phone number. Ask the school admin to confirm your number is on file." }, { status: 404 });
          }
          // One parent can appear several times (e.g. imported per child). Link every child
          // registered under the same phone in this school so the portal shows them all.
          try {
            const last10 = digits.slice(-10);
            const { data: same } = await supabaseAdmin.from("parents").select("id, phone").eq("school_id", row.school_id);
            const dupIds = (same ?? []).filter((p) => (p.phone || "").replace(/\D/g, "").slice(-10) === last10 && p.id !== row.parent_id).map((p) => p.id);
            if (dupIds.length) {
              const [{ data: theirs }, { data: mine }] = await Promise.all([
                supabaseAdmin.from("student_parents").select("student_id, relationship").in("parent_id", dupIds),
                supabaseAdmin.from("student_parents").select("student_id").eq("parent_id", row.parent_id),
              ]);
              const have = new Set((mine ?? []).map((m) => m.student_id));
              const add = (theirs ?? []).filter((t) => !have.has(t.student_id) && (have.add(t.student_id), true))
                .map((t) => ({ parent_id: row.parent_id, student_id: t.student_id, relationship: t.relationship, is_primary: false }));
              if (add.length) await supabaseAdmin.from("student_parents").insert(add);
            }
          } catch { /* linking is best-effort; sign-in still works */ }
          const { signParentToken } = await import("@/lib/parent-auth.server");
          const token = signParentToken({ parent_id: row.parent_id, school_id: row.school_id });
          return Response.json({ token, parent: { id: row.parent_id, full_name: row.full_name, school_id: row.school_id } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Login failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
