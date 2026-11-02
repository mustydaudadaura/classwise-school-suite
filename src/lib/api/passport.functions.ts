import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenAI } from "@google/genai";
import { buildLocalStudioCalibration } from "@/lib/passport-photo-helper";

const PassportEnhanceInput = z.object({
  school_id: z.string().uuid(),
  image_base64: z.string().min(1),
  target_type: z.enum(["student", "teacher", "applicant"]).default("student"),
  target_id: z.string().optional(),
  mode: z.enum(["auto", "ai", "local"]).optional().default("auto"),
});

const UpdatePassportPhotoInput = z.object({
  school_id: z.string().uuid(),
  target_type: z.enum(["student", "teacher"]).default("student"),
  target_id: z.string().min(1),
  photo_url: z.string().min(1),
});

export const enhancePassportPhotoWithGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PassportEnhanceInput.parse(d))
  .handler(async ({ data }) => {
    // If the user explicitly selected local studio calibration, avoid any API call and use zero credits
    if (data.mode === "local") {
      return {
        success: true,
        analysis: buildLocalStudioCalibration("local_configured"),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const cleanBase64 = data.image_base64.replace(/^data:[^;]+;base64,/, "");

    let analysisResult = buildLocalStudioCalibration("local_fallback");

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        const prompt = `You are a certified passport biometric and photograph compliance officer.
Analyze this uploaded photograph for an official school student or teacher ID card / passport photograph.
CRITICAL MANDATE:
1. The human face MUST be 100% preserved with zero facial distortion, zero morphing, and zero synthetic alteration.
2. Evaluate adherence to standard 35x45mm passport photograph standards:
   - Is a face clearly visible facing forward?
   - Are eyes open, level, and visible?
   - Is lighting balanced (no deep shadows)?
   - Recommend fine calibration adjustments (brightness, contrast, zoom).
Return ONLY a valid JSON object with the following schema:
{
  "face_detected": boolean,
  "face_centered_score": number (0-100),
  "eyes_level": boolean,
  "lighting_calibrated": boolean,
  "background_neutral": boolean,
  "standard_ratio_compliant": boolean,
  "guidance_notes": string,
  "crop_recommendation": {
    "zoom": number (e.g. 1.0 to 1.3),
    "brightness_adjustment": number (95-115),
    "contrast_adjustment": number (95-115)
  }
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: data.image_base64.startsWith("data:image/png") ? "image/png" : "image/jpeg",
              },
            },
            { text: prompt },
          ],
          config: {
            responseMimeType: "application/json",
          },
        });

        const textOutput = response.text || "";
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysisResult = {
            face_detected: Boolean(parsed.face_detected ?? true),
            face_centered_score: Number(parsed.face_centered_score ?? 98),
            eyes_level: Boolean(parsed.eyes_level ?? true),
            lighting_calibrated: Boolean(parsed.lighting_calibrated ?? true),
            background_neutral: Boolean(parsed.background_neutral ?? true),
            standard_ratio_compliant: Boolean(parsed.standard_ratio_compliant ?? true),
            fallback_used: false,
            mode_used: "ai",
            guidance_notes: String(parsed.guidance_notes || "100% face preserved. Passport standard calibrated."),
            crop_recommendation: {
              zoom: Number(parsed.crop_recommendation?.zoom ?? 1.05),
              brightness_adjustment: Number(parsed.crop_recommendation?.brightness_adjustment ?? 104),
              contrast_adjustment: Number(parsed.crop_recommendation?.contrast_adjustment ?? 108),
            },
          };
        }
      } catch {
        // Graceful fallback to intelligent local studio calibration when API credits or quotas are exhausted
        analysisResult = buildLocalStudioCalibration("local_fallback");
      }
    }

    return {
      success: true,
      analysis: analysisResult,
    };
  });

export const savePassportPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdatePassportPhotoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: db } = context;

    if (data.target_type === "student") {
      const { data: saved, error } = await db
        .from("students")
        .update({ photo_url: data.photo_url })
        .eq("id", data.target_id)
        .eq("school_id", data.school_id)
        .select("id, photo_url")
        .single();
      if (error || !saved) throw new Error(error?.message || "Student passport photograph could not be saved");
      return { success: true, message: "Student passport photograph updated successfully" };
    }

    if (data.target_type === "teacher") {
      // Update both profiles and staff_profiles
      const p1 = db
        .from("profiles")
        .update({ avatar_url: data.photo_url })
        .eq("user_id", data.target_id)
        .eq("school_id", data.school_id);

      const p2 = db
        .from("staff_profiles")
        .update({ photo_url: data.photo_url })
        .eq("user_id", data.target_id)
        .eq("school_id", data.school_id);

      await Promise.all([p1, p2]);
      return { success: true, message: "Teacher / Staff passport photograph updated successfully" };
    }

    return { success: true };
  });
