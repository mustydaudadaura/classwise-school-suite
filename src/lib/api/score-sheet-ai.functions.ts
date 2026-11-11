import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid(),
  mime: z.string().max(100),
  content: z.string().min(20).max(14_000_000), // base64 photo/scan/PDF
  students: z.array(z.object({ id: z.string().uuid(), admission_no: z.string(), name: z.string() })).max(300),
  subjects: z.array(z.object({ id: z.string().uuid(), name: z.string() })).max(40),
  maxes: z.object({ ca1: z.number(), ca2: z.number(), exam: z.number() }),
});

const INSTRUCTIONS = `You read handwritten Nigerian school score sheets (broadsheets) that were printed from the school portal and filled with pen, then scanned or photographed.
Each row is one student (serial number, admission number, name). For every subject there are columns for CA1, CA2 (may be absent) and Exam.
Read ONLY what is actually written. Never guess or invent a score: if a cell is empty, crossed out or unreadable, return null for it and list it in "unclear".
Match each row to the given student list by admission number first, then by name. Match subject columns to the given subject list.`;

const Schema = {
  type: "object", additionalProperties: false, required: ["scores", "unclear"],
  properties: {
    scores: { type: "array", items: { type: "object", additionalProperties: false, required: ["student_id", "subject_id", "ca1", "ca2", "exam"],
      properties: { student_id: { type: "string" }, subject_id: { type: "string" }, ca1: { type: ["number", "null"] }, ca2: { type: ["number", "null"] }, exam: { type: ["number", "null"] } } } },
    unclear: { type: "array", items: { type: "string" } },
  },
};

export const readScoreSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "academics.view" });
    if (!allowed) throw new Error("You don't have access to score entry for this school");
    const { data: cls } = await supabase.from("classes").select("id").eq("id", data.class_id).eq("school_id", data.school_id).maybeSingle();
    if (!cls) throw new Error("Class not found in this school");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI reading is not configured");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    const context_text = `Return json. Max marks: CA1 ${data.maxes.ca1}, CA2 ${data.maxes.ca2 || "not used"}, Exam ${data.maxes.exam}.
STUDENTS (id | admission no | name):\n${data.students.map((s) => `${s.id} | ${s.admission_no} | ${s.name}`).join("\n")}
SUBJECTS (id | name):\n${data.subjects.map((s) => `${s.id} | ${s.name}`).join("\n")}`;
    const parts: any[] = [{ type: "text", text: context_text }];
    if (data.mime === "application/pdf") parts.push({ type: "file", filename: "score-sheet.pdf", data: data.content, mediaType: "application/pdf" });
    else parts.push({ type: "image", image: new URL(`data:${data.mime};base64,${data.content}`) });

    const { jsonSchema, Output } = await import("ai");
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content: parts }],
      output: Output.object({ schema: jsonSchema<{ scores: { student_id: string; subject_id: string; ca1: number | null; ca2: number | null; exam: number | null }[]; unclear: string[] }>(Schema as any) }),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    let text = "";
    try { text = await result.text; } catch (e) { console.error("score sheet AI failed", e); throw new Error("The AI could not read this sheet. Try a clearer photo."); }
    let parsed: { scores: any[]; unclear: string[] };
    try { const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); parsed = JSON.parse(raw); } catch { throw new Error("The AI could not read this sheet. Try a clearer photo."); }
    const okStudent = new Set(data.students.map((s) => s.id)), okSubject = new Set(data.subjects.map((s) => s.id));
    const clamp = (v: unknown, max: number) => (typeof v === "number" && v >= 0 && v <= max ? v : null);
    const scores = (parsed.scores ?? []).filter((r) => okStudent.has(r.student_id) && okSubject.has(r.subject_id)).map((r) => ({
      student_id: r.student_id as string, subject_id: r.subject_id as string,
      ca1: clamp(r.ca1, data.maxes.ca1), ca2: data.maxes.ca2 ? clamp(r.ca2, data.maxes.ca2) : 0, exam: clamp(r.exam, data.maxes.exam),
    })).filter((r) => r.ca1 !== null || r.exam !== null || (r.ca2 ?? null) !== null);
    return { scores, unclear: (parsed.unclear ?? []).map(String).slice(0, 50) };
  });
