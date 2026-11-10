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
