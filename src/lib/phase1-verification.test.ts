import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeImageFingerprint,
  getCachedEnhancedPhoto,
  setCachedEnhancedPhoto,
  clearEnhancedPhotoCache,
  isCreditOrQuotaExhaustedError,
  buildLocalStudioCalibration,
} from "./passport-photo-helper";
import {
  parseLessonPlanJson,
  buildFallbackNerdcLessonPlan,
} from "./lesson-plan";
import {
  generateLessonPlanCentralized,
  analyzePassportPhotoQuality,
} from "./gemini-ai.server";
import { verifyRegistrationReview } from "./registration-review";
import { requireSavedRecord } from "./registry-save";
import { protectRoleRemoval } from "./registry-lifecycle";

test("passport photo helper caches enhanced images by fingerprint to avoid duplicate API calls", () => {
  clearEnhancedPhotoCache();
  const rawPhoto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/sampleStudentPortrait123";
  const enhancedPhoto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/enhancedWhiteBgPortrait123";

  assert.equal(getCachedEnhancedPhoto(rawPhoto), null);
  setCachedEnhancedPhoto(rawPhoto, enhancedPhoto);

  assert.equal(getCachedEnhancedPhoto(rawPhoto), enhancedPhoto);
  // Enhancing the already-enhanced image also hits cache without calling API again
  assert.equal(getCachedEnhancedPhoto(enhancedPhoto), enhancedPhoto);
  assert.notEqual(computeImageFingerprint(rawPhoto), computeImageFingerprint(enhancedPhoto));
});

test("passport photo helper detects API credit exhaustion (402), rate limits (429), and missing keys", () => {
  assert.equal(isCreditOrQuotaExhaustedError(402), true);
  assert.equal(isCreditOrQuotaExhaustedError(429), true);
  assert.equal(isCreditOrQuotaExhaustedError(500), true);
  assert.equal(isCreditOrQuotaExhaustedError(new Error("AI credits have run out (402)")), true);
  assert.equal(isCreditOrQuotaExhaustedError(new Error("GEMINI_API_KEY is not configured")), true);
  assert.equal(isCreditOrQuotaExhaustedError({ status: 402, message: "Payment Required" }), true);
  assert.equal(isCreditOrQuotaExhaustedError(200), false);
});

test("passport photo helper provides configurable local studio calibration and graceful fallback", () => {
  const configuredLocal = buildLocalStudioCalibration("local_configured");
  assert.equal(configuredLocal.face_detected, true);
  assert.equal(configuredLocal.fallback_used, false);
  assert.equal(configuredLocal.mode_used, "local_configured");
  assert.ok(configuredLocal.guidance_notes.includes("Zero API Credits"));

  const fallbackStudio = buildLocalStudioCalibration("local_fallback", { zoom: 1.08 });
  assert.equal(fallbackStudio.face_detected, true);
  assert.equal(fallbackStudio.fallback_used, true);
  assert.equal(fallbackStudio.mode_used, "local_fallback");
  assert.equal(fallbackStudio.crop_recommendation.zoom, 1.08);
});

test("analyzePassportPhotoQuality gracefully falls back when Gemini API credits or keys are unavailable", async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = await analyzePassportPhotoQuality("data:image/jpeg;base64,dGVzdA==");
    assert.equal(res.success, true);
    assert.equal(res.fallbackUsed, true);
    assert.equal(res.data?.face_detected, true);
    assert.equal(res.data?.plain_background, true);
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
  }
});

test("parseLessonPlanJson parses markdown-fenced JSON and normalizes NERDC lesson plan fields", () => {
  const raw = `\`\`\`json
  {
    "sub_topics": ["Meaning of Fractions", "Types of Fractions"],
    "specific_objectives": ["define a fraction", "identify proper and improper fractions"],
    "rationale": "Foundational numeracy skill",
    "previous_knowledge": "Pupils can count whole numbers",
    "instructional_materials": ["Orange", "Fraction chart"],
    "presentation": [
      {
        "stage": "INTRODUCTION",
        "teacher_activities": "Cuts an orange into equal halves",
        "learning_activities": "Observe the equal parts",
        "learning_point": "Concept of a part of a whole"
      }
    ],
    "evaluation": ["What is a fraction?"],
    "summary": "A fraction represents equal parts of a whole.",
    "assignment": ["Draw 3 fractions in your workbook."],
    "lesson_note": "# FRACTIONS\\nA fraction is a part of a whole."
  }
  \`\`\``;

  const plan = parseLessonPlanJson(raw, {
    topic: "Fractions",
    subject: "Mathematics",
    class_name: "Primary 4",
  });

  assert.equal(plan.sub_topics.length, 2);
  assert.equal(plan.presentation[0].stage, "INTRODUCTION");
  assert.ok(plan.lesson_note.includes("# FRACTIONS"));
});

test("buildFallbackNerdcLessonPlan and generateLessonPlanCentralized succeed when AI credits are exhausted", async () => {
  const fallback = buildFallbackNerdcLessonPlan({
    topic: "Photosynthesis",
    subject: "Basic Science",
    class_name: "JSS 2",
  });
  assert.ok(fallback.sub_topics.length >= 3);
  assert.ok(fallback.specific_objectives.length >= 3);
  assert.ok(fallback.presentation.length >= 4);
  assert.ok(fallback.lesson_note.includes("PHOTOSYNTHESIS"));

  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const centralized = await generateLessonPlanCentralized({
      school_name: "Alegacy Model Academy",
      class_name: "JSS 2",
      subject: "Basic Science",
      topic: "Photosynthesis",
      week: 3,
      term: "first",
    });
    assert.equal(centralized.success, true);
    assert.equal(centralized.fallbackUsed, true);
    assert.equal(centralized.data?.topic, "Photosynthesis");
    assert.ok((centralized.data?.presentation_steps.length ?? 0) >= 4);
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
  }
});

test("student, staff, and campus record updates enforce school-scoped verification and role safeguards", () => {
  // Active student edit preserves active state and confirms updated personal fields
  const updatedStudent = {
    id: "stu-101",
    school_id: "sch-1",
    active: true,
    pending_activation: false,
    admission_no: "ADM/2026/001",
    first_name: "Amina",
    last_name: "Ibrahim",
    middle_name: "Zainab",
    gender: "female",
    dob: "2014-05-12",
    class_id: "cls-jss1",
  };
  const verified = verifyRegistrationReview(
    updatedStudent,
    "stu-101",
    "edit",
    {
      admission_no: "ADM/2026/001",
      first_name: "Amina",
      last_name: "Ibrahim",
      middle_name: "Zainab",
      gender: "female",
      dob: "2014-05-12",
      class_id: "cls-jss1",
    },
    { active: true, pending_activation: false }
  );
  assert.equal(verified.first_name, "Amina");
  assert.equal(verified.active, true);

  // Saved record verification rejects cross-school or null writes
  assert.equal(requireSavedRecord(updatedStudent, "sch-1").id, "stu-101");
  assert.throws(() => requireSavedRecord(updatedStudent, "sch-other"));

  // Role lifecycle protection prevents self-removal or super_admin deletion
  assert.throws(() => protectRoleRemoval("admin-1", "admin-1", "school_admin"));
  assert.throws(() => protectRoleRemoval("admin-1", "super-1", "super_admin"));
  assert.doesNotThrow(() => protectRoleRemoval("admin-1", "teacher-1", "teacher"));
});
