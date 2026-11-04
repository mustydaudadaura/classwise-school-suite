import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type LessonHeader, type LessonPlan, parseLessonPlanJson } from "@/lib/lesson-plan";

const Input = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  topic: z.string().trim().min(2).max(200),
  week: z.number().int().min(1).max(15),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extra: z.string().max(1000).optional(),
});

const LessonPlanSchema = z.object({
  sub_topics: z.array(z.string()),
  specific_objectives: z.array(z.string()),
  rationale: z.string(),
  previous_knowledge: z.string(),
  instructional_materials: z.array(z.string()),
  reference_materials: z.array(z.string()),
  presentation: z.array(z.object({
    stage: z.string(),
    teacher_activities: z.string(),
    learning_activities: z.string(),
    learning_point: z.string(),
  })),
  evaluation: z.array(z.string()),
  summary: z.string(),
  assignment: z.array(z.string()),
  lesson_note: z.string(),
  video_searches: z.array(z.string()),
});

const TERMS: Record<string, string> = { first: "1ST", second: "2ND", third: "3RD" };
const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const INSTRUCTIONS = `You are an experienced Nigerian subject specialist teacher writing an official government-format lesson plan and lesson note (NERDC curriculum, UBE / WAEC / NECO standards, as inspected by State Ministries of Education).
Accuracy rules:
- Teach the actual subject matter of the given topic. Use correct facts, definitions, formulas, rules, grammar, dates and names. Never invent facts; if unsure, use the standard textbook position.
- Mathematics/sciences: include formulas, units and fully worked examples with correct answers.
- Languages (English, Hausa, Yoruba, Igbo, French, Arabic): give real example words/sentences in that language.
- Religious subjects (IRS/CRS/Islamic Studies/Arabic): quote real verses/hadith/passages with correct references only.
- Social studies, civic, history, business: use real Nigerian institutions, laws, places and examples.
- Never use placeholder text such as "meaning of the topic", "key features of the topic" or "solve the exercise on the board".
Fields:
- sub_topics: 3-6 real sub-topics of this topic.
- specific_objectives: 3-5 measurable objectives with action verbs (no lead-in sentence).
- presentation: "INTRODUCTION", then "STEP I", "STEP II"... one per sub-topic, then "CONCLUSION". Teacher activities must contain the actual content being taught.
- evaluation: 4-5 real questions on the content taught.
- assignment: 1-3 concrete tasks.
- lesson_note: a detailed board note in Markdown with a heading per sub-topic, containing definitions, explanations, examples (with answers) and Nigerian context — the full note learners copy.
- video_searches: 3-4 short YouTube search phrases for explainer videos on this topic.
Match the language level to the class.`;

export const generateLessonNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "academics.view" });
    if (!allowed) throw new Error("You don't have access to lesson planning for this school");

    const [school, cls, subj, students, slots, prof] = await Promise.all([
      supabase.from("schools").select("name,address,current_session,current_term").eq("id", data.school_id).maybeSingle(),
      supabase.from("classes").select("name,section").eq("id", data.class_id).eq("school_id", data.school_id).maybeSingle(),
      supabase.from("subjects").select("name").eq("id", data.subject_id).eq("school_id", data.school_id).maybeSingle(),
      supabase.from("students").select("gender,dob").eq("class_id", data.class_id).eq("status", "active"),
      supabase.from("timetable_slots").select("day_of_week,start_time,end_time").eq("class_id", data.class_id).eq("subject_id", data.subject_id).order("day_of_week").order("start_time"),
      supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (!cls.data || !subj.data) throw new Error("Class or subject not found");

    const st = students.data ?? [];
    const now = new Date(data.week_start);
    const ages = st.filter((s) => s.dob).map((s) => Math.floor((now.getTime() - new Date(s.dob!).getTime()) / 31557600000));
    const male = st.filter((s) => s.gender === "male").length, female = st.filter((s) => s.gender === "female").length;
    const sl = slots.data ?? [];
    const totalMin = sl.reduce((a, s) => a + mins(s.end_time) - mins(s.start_time), 0);
    const start = new Date(data.week_start);
    const end = new Date(start); end.setDate(start.getDate() + 4);
    const term = school.data?.current_term ?? "first";

    const header: LessonHeader = {
      school_name: school.data?.name ?? "", school_address: school.data?.address ?? "",
      session: school.data?.current_session ?? "", term: TERMS[term] ?? "", week: data.week,
      class_name: cls.data.name, subject: subj.data.name, topic: data.topic,
      date: `${fmtDate(start)} – ${fmtDate(end)}`,
      period: sl.length ? `${sl.length} period${sl.length > 1 ? "s" : ""}` : "One period",
      duration: totalMin ? `${totalMin} Minutes` : "40 Minutes",
      time: sl.length ? sl.map((s) => `${DAYS[s.day_of_week].slice(0, 3)} ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`).join(", ") : "As timetabled",
      no_in_class: st.length,
      average_age: ages.length ? `${Math.min(...ages)}-${Math.max(...ages)} years` : "",
      sex: male && female ? "Mixed" : male ? "Male" : female ? "Female" : "Mixed",
      teacher: prof.data?.full_name ?? "",
    };

    const promptText = `Subject: ${header.subject}
Class: ${header.class_name}${cls.data.section ? ` (${cls.data.section} section)` : ""}
Term: ${header.term} term, Week ${data.week}, ${header.session} session
Topic: ${data.topic}
Duration: ${header.duration} (${header.period})
Learners: ${header.no_in_class || "unknown"}, ages ${header.average_age || "typical for this class"}
${data.extra ? `Teacher notes: ${data.extra}` : ""}

Write the real subject content for THIS topic: correct definitions, facts, formulas, rules, worked examples with answers, dates, names and diagrams descriptions as a ${header.subject} specialist would teach them. Do not write generic filler such as "the meaning of the topic" or "key features of the topic" — every sentence must be specific to "${data.topic}".`;

    const isComplete = (p: LessonPlan | null): p is LessonPlan => !!p && !!p.lesson_note?.trim() && p.presentation.length > 0;
    let lastStatus: number | undefined;

    // 0. Gemini first (school's own free Google AI Studio key).
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      for (const model of ["gemini-flash-latest", "gemini-flash-lite-latest"]) {
        try {
          const plan = await generateWithCompatible("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model, geminiKey, promptText);
          if (isComplete(plan)) return { header, plan, provider: "gemini" as const };
        } catch (err: any) {
          console.error(`Gemini (${model}) lesson generation failed, trying next:`, err?.message);
        }
      }
    }

    // 1. DeepSeek next (school's own DeepSeek account).
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      try {
        const plan = await generateWithDeepSeek(deepseekKey, promptText);
        if (isComplete(plan)) return { header, plan, provider: "deepseek" as const };
      } catch (err: any) {
        console.error("DeepSeek lesson generation failed, trying ChatGPT:", err?.message);
      }
    }

    // 2. ChatGPT through the built-in AI as backup.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const plan = await generateWithChatGpt(apiKey, promptText);
        if (isComplete(plan)) return { header, plan, provider: "chatgpt" as const };
      } catch (err: any) {
        lastStatus = err?.status;
        console.error("ChatGPT lesson generation failed:", lastStatus, err?.message);
      }
    }

    if (!geminiKey && !deepseekKey && !apiKey) throw new Error("The lesson AI is not configured. Please contact the school administrator.");
    if (lastStatus === 402) throw new Error("Gemini/DeepSeek did not answer and AI credits have run out. Check your DeepSeek balance or top up credits, then try again.");
    if (lastStatus === 429) throw new Error("The lesson AI is busy right now. Please wait a minute and try again.");
    throw new Error("The lesson AI could not write this lesson right now. Please try again.");
  });

function generateWithDeepSeek(key: string, promptText: string) {
  return generateWithCompatible("https://api.deepseek.com/chat/completions", "deepseek-chat", key, promptText);
}

async function generateWithCompatible(url: string, model: string, key: string, promptText: string): Promise<LessonPlan | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      stream: false,
      response_format: { type: "json_object" },
      max_tokens: 8000,
      messages: [
        { role: "system", content: `${INSTRUCTIONS}\nReturn ONLY one json object with exactly these keys: sub_topics, specific_objectives, rationale, previous_knowledge, instructional_materials, reference_materials, presentation (array of {stage, teacher_activities, learning_activities, learning_point}), evaluation, summary, assignment, lesson_note, video_searches.` },
        { role: "user", content: `${promptText}\n\nReturn the lesson as json.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body: any = await res.json();
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) return null;
  return parseLessonPlanJson(text);
}

async function generateWithChatGpt(apiKey: string, promptText: string): Promise<LessonPlan | null> {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let streamErr: any = null;
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      prompt: promptText,
      output: Output.object({ schema: LessonPlanSchema }),
      onError: ({ error }) => { streamErr = error; },
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    const out = await result.output;
    return { ...out, lesson_note: out.lesson_note.trim() };
  } catch (err: any) {
    if (NoObjectGeneratedError.isInstance(err) && err.text) return parseLessonPlanJson(err.text);
    const src = streamErr ?? err;
    const e = new Error(src?.message ?? "ChatGPT failed") as Error & { status?: number };
    e.status = src?.statusCode ?? src?.status ?? src?.cause?.statusCode;
    throw e;
  }
}
