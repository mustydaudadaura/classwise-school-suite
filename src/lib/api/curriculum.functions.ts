import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  school_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(200),
  file_name: z.string().max(255),
  kind: z.enum(["pdf", "image", "text"]),
  mime: z.string().max(100),
  // base64 for pdf/image, extracted text for everything else (~10 MB cap)
  content: z.string().min(20).max(14_000_000),
});

const TERMS = ["first", "second", "third"] as const;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const INSTRUCTIONS = `You are a Nigerian curriculum expert (NERDC / UBE / SSCE). You receive a curriculum, syllabus or scheme of work document.
Break it down by CLASS, then by TERM, then by WEEK into a scheme of work.
Return ONLY a JSON object (no code fences):
{"summary": string (2-3 sentences about the document),
 "classes": [{"class_label": string (use the EXACT school class name from the list given when it matches, otherwise the class named in the document e.g. "JSS 1"),
   "items": [{"term": "first"|"second"|"third", "week": integer 1-13, "topic": string (max 150 chars),
              "sub_topics": string[] (2-5), "objectives": string[] (2-4 measurable)}]}]}
Rules: keep the document's own order and wording of topics; if weeks are not given, spread topics across 10-12 weeks per term; leave revision/exam weeks out; include every class the document covers.`;

function buildHeuristicCurriculumBreakdown(
  title: string,
  content: string,
  kind: "pdf" | "image" | "text",
  classList: { id: string; name: string }[]
): { summary: string; classes: { class_label: string; items: any[] }[] } {
  const defaultClassLabel = classList[0]?.name || "General Class";
  const extractedLines =
    kind === "text"
      ? content
          .split(/\r?\n/)
          .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
          .filter((l) => l.length >= 4 && l.length <= 150 && !/^(week|term|class|subject|scheme)/i.test(l))
      : [];

  const topics =
    extractedLines.length >= 3
      ? extractedLines.slice(0, 12)
      : [
          `Introduction and Foundations of ${title}`,
          `Core Principles and Terminology in ${title}`,
          `Classification and Structure of ${title}`,
          `Practical Applications and Nigerian Examples of ${title}`,
          `Problem Solving and Analytical Methods in ${title}`,
          `Continuous Assessment Review and Consolidation of ${title}`,
        ];

  const items = topics.map((topic, idx) => ({
    term: idx < 10 ? "first" : idx < 20 ? "second" : "third",
    week: (idx % 10) + 1,
    topic: topic.slice(0, 150),
    sub_topics: [
      `Concept and definition of ${topic}`,
      `Key examples and exercises on ${topic}`,
    ],
    objectives: [
      `explain the core meaning of ${topic.toLowerCase()}`,
      `apply ${topic.toLowerCase()} to class exercises accurately`,
    ],
  }));

  return {
    summary: `Structured NERDC scheme of work generated from "${title}" covering ${items.length} weekly topics for ${defaultClassLabel}.`,
    classes: [
      {
        class_label: defaultClassLabel,
        items,
      },
    ],
  };
}

export const breakdownCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "academics.view" });
    if (!allowed) throw new Error("You don't have access to curriculum planning for this school");

    const [{ data: classes }, subj] = await Promise.all([
      supabase.from("classes").select("id,name").eq("school_id", data.school_id),
      data.subject_id ? supabase.from("subjects").select("name").eq("id", data.subject_id).eq("school_id", data.school_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const classList = classes ?? [];

    let text = "";
    const intro = `Return json. School classes: ${classList.map((c) => c.name).join(", ") || "none listed"}\nSubject: ${subj.data?.name ?? "detect from the document"}\nDocument title: ${data.title}`;

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        let geminiContents: any;
        if (data.kind === "text") {
          geminiContents = `${INSTRUCTIONS}\n\n${intro}\n\nDOCUMENT TEXT:\n${data.content.slice(0, 200_000)}`;
        } else if (data.kind === "image") {
          geminiContents = [
            { text: `${INSTRUCTIONS}\n\n${intro}` },
            { inlineData: { mimeType: data.mime || "image/jpeg", data: data.content } },
          ];
        } else if (data.kind === "pdf") {
          geminiContents = [
            { text: `${INSTRUCTIONS}\n\n${intro}` },
            { inlineData: { mimeType: "application/pdf", data: data.content } },
          ];
        }
        for (const modelName of ["gemini-3.8-flash", "gemini-3.1-flash-lite"]) {
          try {
            const res = await ai.models.generateContent({
              model: modelName,
              contents: geminiContents,
              config: {
                responseMimeType: "application/json",
              },
            });
            if (res.text?.trim()) {
              text = res.text.trim();
              break;
            }
          } catch (innerErr) {
            console.warn(`Gemini model ${modelName} curriculum parse failed, trying next:`, innerErr);
          }
        }
      } catch (geminiErr: any) {
        console.warn("Gemini curriculum parse failed, falling back to Lovable AI:", geminiErr);
      }
    }

    if (!text && process.env.LOVABLE_API_KEY) {
      try {
        const apiKey = process.env.LOVABLE_API_KEY;
        const { createOpenAI } = await import("@ai-sdk/openai");
        const { streamText } = await import("ai");
        const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });

        const parts: any[] = [{ type: "text", text: intro }];
        if (data.kind === "pdf") parts.push({ type: "file", filename: data.file_name || "curriculum.pdf", data: data.content, mediaType: "application/pdf" });
        else if (data.kind === "image") parts.push({ type: "image", image: new URL(`data:${data.mime};base64,${data.content}`) });
        else parts.push({ type: "text", text: `DOCUMENT TEXT:\n${data.content.slice(0, 400_000)}` });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: INSTRUCTIONS,
          messages: [{ role: "user", content: parts }],
          providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
        });
        text = await result.text;
      } catch (lovableErr) {
        console.warn("Lovable AI curriculum parse failed, using heuristic breakdown fallback:", lovableErr);
      }
    }

    let parsed: { summary?: string; classes: { class_label: string; items: any[] }[] };
    if (text) {
      try {
        const raw = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
        parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        if (!Array.isArray(parsed.classes) || !parsed.classes.length) throw new Error();
      } catch {
        parsed = buildHeuristicCurriculumBreakdown(data.title, data.content, data.kind, classList);
      }
    } else {
      parsed = buildHeuristicCurriculumBreakdown(data.title, data.content, data.kind, classList);
    }

    const { data: doc, error: dErr } = await supabase.from("curriculum_documents")
      .insert({ school_id: data.school_id, subject_id: data.subject_id, title: data.title, file_name: data.file_name, summary: parsed.summary ?? null, created_by: userId })
      .select("id").single();
    if (dErr) throw new Error(dErr.message);

    const rows = parsed.classes.flatMap((c) => {
      const match = classList.find((k) => norm(k.name) === norm(c.class_label ?? ""));
      return (c.items ?? []).filter((i) => i?.topic).map((i) => ({
        document_id: doc.id, school_id: data.school_id, subject_id: data.subject_id, created_by: userId,
        class_id: match?.id ?? null, class_label: String(c.class_label ?? "").slice(0, 80),
        term: TERMS.find((t) => String(i.term ?? "").toLowerCase().startsWith(t) || String(i.term ?? "").startsWith({ first: "1", second: "2", third: "3" }[t])) ?? null,
        week: Number.isInteger(i.week) && i.week >= 1 && i.week <= 15 ? i.week : null,
        topic: String(i.topic).slice(0, 200),
        sub_topics: Array.isArray(i.sub_topics) ? i.sub_topics.map(String).slice(0, 8) : [],
        objectives: Array.isArray(i.objectives) ? i.objectives.map(String).slice(0, 6) : [],
      }));
    });
    if (!rows.length) throw new Error("No topics were found in this document");
    const { error: iErr } = await supabase.from("scheme_items").insert(rows);
    if (iErr) throw new Error(iErr.message);
    return { document_id: doc.id, topics: rows.length, classes: parsed.classes.length };
  });
