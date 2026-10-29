import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenAI } from "@google/genai";

const AnalyzeInput = z.object({
  school_id: z.string().uuid(),
  file_name: z.string().max(255),
  kind: z.enum(["image", "pdf", "text"]),
  mime: z.string().max(100),
  // base64 for image/pdf, or raw text content
  content: z.string().min(10).max(14_000_000),
  class_names: z.array(z.string()).default([]),
});

const BatchSaveInput = z.object({
  school_id: z.string().uuid(),
  save_mode: z.enum(["admissions", "students_direct"]),
  records: z.array(
    z.object({
      id: z.string(),
      admission_no: z.string().optional(),
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      middle_name: z.string().nullable().optional(),
      gender: z.enum(["male", "female"]).nullable().optional(),
      dob: z.string().nullable().optional(),
      class_id: z.string().uuid().nullable().optional(),
      class_name: z.string().nullable().optional(),
      parent_name: z.string().nullable().optional(),
      parent_phone: z.string().nullable().optional(),
      parent_email: z.string().nullable().optional(),
      relationship: z.string().default("father"),
      address: z.string().nullable().optional(),
      state_of_origin: z.string().nullable().optional(),
      previous_school: z.string().nullable().optional(),
      passport_base64: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
  ).min(1),
});

const EXTRACTION_PROMPT = `You are an expert OCR & document analysis AI for Nigerian schools (Primary, Junior Secondary, Senior Secondary).
You are analyzing a photograph, scan, or text of student registration sheets, admission ledgers, entrance examination score sheets, or master lists.

Your goal is to extract every student record with maximum fidelity.
IMPORTANT RULES:
1. Preserve the exact spelling of Nigerian names (Yoruba, Hausa, Igbo, Edo, Urhobo, Ijaw, Kanuri, Fulani, etc.).
2. Distinguish missing information from unreadable information.
3. NEVER invent or hallucinate missing student, parent, or score details. If a field is blank or not present, set it to null.
4. Nigerian phone numbers MUST BE PRESERVED AS TEXT starting with "0" (e.g. "08031234567", "08123456789", "090...", "070..."). Do NOT drop leading zeros.
5. If multiple students are listed in columns, rows, or tables on one page, extract ALL of them into individual items.
6. For dates of birth, normalize to YYYY-MM-DD if recognizable; otherwise keep null.
7. Gender should be normalized to "male" or "female" if indicated (e.g., M, F, Boy, Girl); otherwise null.
8. Identify confidence for each record: "high" (clearly legible), "medium" (some characters required inference), or "low" (heavily smudged/uncertain). Add review_flags describing any uncertain field.
9. Match the student's class to the provided school classes list if applicable.

Return ONLY a JSON object with this exact shape:
{
  "document_summary": "Short 1-2 sentence description of the document format and count of detected students",
  "records": [
    {
      "source_row": 1,
      "confidence": "high" | "medium" | "low",
      "review_flags": ["flag description if any"],
      "admission_no": string | null,
      "first_name": string,
      "last_name": string,
      "middle_name": string | null,
      "gender": "male" | "female" | null,
      "dob": string | null,
      "class_applied": string | null,
      "parent_name": string | null,
      "parent_phone": string | null,
      "parent_email": string | null,
      "relationship": "father" | "mother" | "guardian" | "sponsor" | null,
      "address": string | null,
      "state_of_origin": string | null,
      "previous_school": string | null,
      "notes": string | null
    }
  ]
}`;

export const analyzeAdmissionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "students.edit",
    });
    if (!allowed) {
      throw new Error("You don't have permission to register admissions for this school");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server");
    }

    const ai = new GoogleGenAI({ apiKey });

    const contents: any[] = [];
    const contextPrompt = `School classes known: ${data.class_names.join(", ") || "General school classes"}\nDocument filename: ${data.file_name}`;

    if (data.kind === "text") {
      contents.push({
        text: `${EXTRACTION_PROMPT}\n\n${contextPrompt}\n\nDOCUMENT TEXT CONTENT:\n${data.content.slice(0, 500_000)}`,
      });
    } else {
      contents.push({
        text: `${EXTRACTION_PROMPT}\n\n${contextPrompt}\nPlease carefully inspect every handwritten and printed student entry in this document.`,
      });
      contents.push({
        inlineData: {
          mimeType: data.mime || (data.kind === "pdf" ? "application/pdf" : "image/jpeg"),
          data: data.content,
        },
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);
      return {
        ok: true,
        summary: parsed.document_summary || "Document parsed successfully",
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    } catch (err: any) {
      console.error("Gemini Admission Extraction Error:", err);
      throw new Error(err?.message || "Failed to analyze document with AI");
    }
  });

export const batchSaveAdmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BatchSaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "students.edit",
    });
    if (!allowed) {
      throw new Error("You don't have permission to save student admissions");
    }

    // Verify school exists and fetch details for numbering
    const { data: school } = await supabase
      .from("schools")
      .select("id, name, code, current_session")
      .eq("id", data.school_id)
      .single();

    if (!school) throw new Error("School not found");

    const sessionYear = new Date().getFullYear();
    const parentPhoneCache = new Map<string, string>();
    const savedResults: Array<{ id: string; name: string; number: string; status: "success" | "error"; error?: string }> = [];

    for (let i = 0; i < data.records.length; i++) {
      const rec = data.records[i];
      try {
        let photoUrl: string | null = null;

        // If passport image base64 is attached, upload to school-assets storage bucket
        if (rec.passport_base64 && rec.passport_base64.startsWith("data:")) {
          try {
            const [header, base64Data] = rec.passport_base64.split(",");
            const mimeMatch = header.match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const ext = mime.includes("png") ? "png" : "jpg";
            const buffer = Buffer.from(base64Data, "base64");
            const storagePath = `${data.school_id}/passports/${Date.now()}-${i}.${ext}`;

            const { error: uploadErr } = await supabase.storage
              .from("school-assets")
              .upload(storagePath, buffer, { contentType: mime, upsert: true });

            if (!uploadErr) {
              photoUrl = supabase.storage.from("school-assets").getPublicUrl(storagePath).data.publicUrl;
            }
          } catch (pErr) {
            console.warn("Failed to upload passport photo:", pErr);
          }
        }

        // Clean phone numbers (preserve leading zero)
        const cleanPhone = (rec.parent_phone || "").replace(/[^\d+]/g, "").trim();

        if (data.save_mode === "admissions") {
          // Save into admissions table as an applicant application
          const appNo = rec.admission_no?.trim() || `APP-${sessionYear}-${String(Date.now() + i).slice(-6)}`;
          
          const { data: adm, error: admErr } = await supabase
            .from("admissions")
            .insert({
              school_id: data.school_id,
              application_no: appNo,
              first_name: rec.first_name.trim(),
              last_name: rec.last_name.trim(),
              middle_name: rec.middle_name?.trim() || null,
              gender: rec.gender ?? "male",
              dob: rec.dob || null,
              class_applied_id: rec.class_id || null,
              parent_name: rec.parent_name?.trim() || null,
              parent_phone: cleanPhone || null,
              parent_email: rec.parent_email?.trim() || null,
              relationship: rec.relationship || "father",
              previous_school: rec.previous_school?.trim() || null,
              state_of_origin: rec.state_of_origin?.trim() || null,
              notes: rec.notes ? `${rec.notes}${photoUrl ? ` [Passport: ${photoUrl}]` : ""}` : (photoUrl ? `[Passport: ${photoUrl}]` : null),
              stage: "applied",
            })
            .select("id, application_no")
            .single();

          if (admErr) throw admErr;

          savedResults.push({
            id: adm.id,
            name: `${rec.first_name} ${rec.last_name}`,
            number: adm.application_no,
            status: "success",
          });
        } else {
          // Save directly into students and auto-link parent
          const admNo = rec.admission_no?.trim() || `ADM/${school.code || "SCH"}/${sessionYear}/${String(1000 + i + Math.floor(Math.random() * 8999))}`;

          const { data: st, error: stErr } = await supabase
            .from("students")
            .insert({
              school_id: data.school_id,
              admission_no: admNo,
              first_name: rec.first_name.trim(),
              last_name: rec.last_name.trim(),
              middle_name: rec.middle_name?.trim() || null,
              gender: rec.gender ?? null,
              dob: rec.dob || null,
              class_id: rec.class_id || null,
              state_of_origin: rec.state_of_origin?.trim() || null,
              previous_school: rec.previous_school?.trim() || null,
              photo_url: photoUrl,
              admission_date: new Date().toISOString().slice(0, 10),
            })
            .select("id, admission_no")
            .single();

          if (stErr) throw stErr;

          // Link parent if provided
          if (rec.parent_name || cleanPhone) {
            let parentId = cleanPhone ? parentPhoneCache.get(cleanPhone) : undefined;
            if (!parentId && cleanPhone) {
              const { data: exP } = await supabase
                .from("parents")
                .select("id")
                .eq("school_id", data.school_id)
                .eq("phone", cleanPhone)
                .maybeSingle();
              parentId = exP?.id;
            }

            if (!parentId) {
              const { data: newP } = await supabase
                .from("parents")
                .insert({
                  school_id: data.school_id,
                  full_name: rec.parent_name?.trim() || "Parent / Guardian",
                  phone: cleanPhone || null,
                  email: rec.parent_email?.trim() || null,
                  address: rec.address?.trim() || null,
                })
                .select("id")
                .single();
              parentId = newP?.id;
            }

            if (parentId) {
              if (cleanPhone) parentPhoneCache.set(cleanPhone, parentId);
              await supabase.from("student_parents").insert({
                student_id: st.id,
                parent_id: parentId,
                relationship: rec.relationship || "father",
                is_primary: true,
              });
            }
          }

          savedResults.push({
            id: st.id,
            name: `${rec.first_name} ${rec.last_name}`,
            number: st.admission_no,
            status: "success",
          });
        }
      } catch (rowErr: any) {
        console.error(`Error saving student #${i}:`, rowErr);
        savedResults.push({
          id: rec.id,
          name: `${rec.first_name} ${rec.last_name}`,
          number: rec.admission_no || `#${i + 1}`,
          status: "error",
          error: rowErr?.message || "Failed to save record",
        });
      }
    }

    const successCount = savedResults.filter((r) => r.status === "success").length;
    return {
      ok: true,
      total: data.records.length,
      successCount,
      failedCount: data.records.length - successCount,
      results: savedResults,
    };
  });
