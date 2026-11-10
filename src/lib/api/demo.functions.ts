import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAIL = "demo.admin@eduerp-demo.ng";
const DEMO_PASSWORD = "DemoSchool#2026";
const DEMO_SCHOOL_ID = "af91ff67-95eb-4b62-93a0-5617d23a2f1d";

// Ensures the single fictional demo admin exists, scoped to the demo school only.
export const startDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: school } = await supabaseAdmin.from("schools").select("id").eq("id", DEMO_SCHOOL_ID).maybeSingle();
  if (!school) throw new Error("The demo school is not available right now.");

  let userId: string | null = null;
  const { data: prof } = await supabaseAdmin.from("profiles").select("user_id").eq("school_id", DEMO_SCHOOL_ID).eq("full_name", "Demo Administrator").maybeSingle();
  userId = prof?.user_id ?? null;
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
      user_metadata: { full_name: "Demo Administrator" },
    });
    if (error && !/already/i.test(error.message)) throw new Error(error.message);
    userId = data?.user?.id ?? null;
    if (!userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email === DEMO_EMAIL)?.id ?? null;
    }
  }
  if (!userId) throw new Error("Demo account unavailable.");
  await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
  await supabaseAdmin.from("profiles").upsert(
    { user_id: userId, school_id: DEMO_SCHOOL_ID, full_name: "Demo Administrator" }, { onConflict: "user_id" });
  const { data: role } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).eq("role", "school_admin").eq("school_id", DEMO_SCHOOL_ID).maybeSingle();
  if (!role) await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "school_admin", school_id: DEMO_SCHOOL_ID, active: true });
  await supabaseAdmin.from("classes").update({ teacher_id: userId }).eq("school_id", DEMO_SCHOOL_ID).is("teacher_id", null);
  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
