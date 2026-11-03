import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SCRATCH_SETTINGS, generatePin, hashPin } from "@/lib/scratch-cards";

const GenerateInput = z.object({ school_id: z.string().uuid(), count: z.number().int().min(1).max(1000) });

/** Generates cards with the school's current price/views/validity; PINs are returned once and stored only as hashes. */
export const generateScratchCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: db, userId } = context;
    const [{ data: manage }, { data: superAdmin }] = await Promise.all([
      db.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id }),
      db.rpc("is_super_admin", { _user_id: userId }),
    ]);
    if (!manage && !superAdmin) throw new Error("Only school administrators can generate scratch cards");
    const { data: settingsRow } = await db.from("scratch_card_settings").select("price, max_views, validity_days").eq("school_id", data.school_id).maybeSingle();
    const settings = { ...DEFAULT_SCRATCH_SETTINGS, ...(settingsRow ?? {}) };
    const { data: school } = await db.from("schools").select("code").eq("id", data.school_id).maybeSingle();
    const prefix = (school?.code || "SCH").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) || "SCH";
    const batch = crypto.randomUUID();
    const validUntil = new Date(Date.now() + settings.validity_days * 86400000).toISOString();
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const cards: { serial_no: string; pin: string }[] = [];
    const rows = [];
    for (let i = 0; i < data.count; i++) {
      const pin = generatePin();
      const serial = `${prefix}-${stamp}-${batch.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
      cards.push({ serial_no: serial, pin });
      rows.push({
        school_id: data.school_id, batch_id: batch, serial_no: serial, pin_hash: await hashPin(data.school_id, pin),
        price: settings.price, max_views: settings.max_views, valid_until: validUntil, created_by: userId,
      });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("scratch_cards").insert(rows).select("id");
    if (error) throw new Error(error.message);
    if ((inserted ?? []).length !== rows.length) throw new Error("Not every card was saved; please try again");
    return { batch_id: batch, price: settings.price, max_views: settings.max_views, valid_until: validUntil, cards };
  });
