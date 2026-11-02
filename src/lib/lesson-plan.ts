export type LessonHeader = {
  school_name: string; school_address: string; session: string; term: string; week: number;
  class_name: string; subject: string; topic: string; date: string; period: string; duration: string;
  time: string; no_in_class: number; average_age: string; sex: string; teacher: string;
};
export type LessonStep = { stage: string; teacher_activities: string; learning_activities: string; learning_point: string };
export type LessonPlan = {
  sub_topics: string[]; specific_objectives: string[]; rationale: string; previous_knowledge: string;
  instructional_materials: string[]; reference_materials?: string[]; presentation: LessonStep[];
  evaluation: string[]; summary: string; assignment: string[]; lesson_note: string;
  video_searches?: string[];
};

/**
 * Robustly parse a LessonPlan JSON string returned from an LLM, stripping markdown fences
 * and normalizing required array/string fields so minor formatting differences never fail.
 */
export function parseLessonPlanJson(rawText: string, fallbackContext?: { topic: string; subject: string; class_name: string; extra?: string }): LessonPlan {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    if (fallbackContext) {
      return buildFallbackNerdcLessonPlan(fallbackContext);
    }
    throw new Error("Invalid JSON structure in lesson plan response");
  }

  const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
  if (!parsed || typeof parsed !== "object") {
    if (fallbackContext) return buildFallbackNerdcLessonPlan(fallbackContext);
    throw new Error("Lesson plan response is not an object");
  }

  const topic = fallbackContext?.topic || "Lesson Topic";
  const subject = fallbackContext?.subject || "Subject";
  const className = fallbackContext?.class_name || "Class";

  const subTopics: string[] = Array.isArray(parsed.sub_topics) && parsed.sub_topics.length > 0
    ? parsed.sub_topics.map(String)
    : [
        `Meaning and Concept of ${topic}`,
        `Key Principles and Examples of ${topic}`,
        `Practical Applications of ${topic} in Nigeria`,
      ];

  const presentation: LessonStep[] = Array.isArray(parsed.presentation) && parsed.presentation.length > 0
    ? parsed.presentation.map((step: any, i: number) => ({
        stage: String(step.stage || step.step || (i === 0 ? "INTRODUCTION" : `STEP ${i}`)),
        teacher_activities: String(step.teacher_activities || step.teacher_activity || `Explains key concepts of ${subTopics[i] || topic}.`),
        learning_activities: String(step.learning_activities || step.student_activity || "Listen attentively, take notes, and ask questions."),
        learning_point: String(step.learning_point || step.key_concept || `Understanding ${subTopics[i] || topic}.`),
      }))
    : buildFallbackNerdcLessonPlan({ topic, subject, class_name: className }).presentation;

  return {
    sub_topics: subTopics,
    specific_objectives: Array.isArray(parsed.specific_objectives) && parsed.specific_objectives.length > 0
      ? parsed.specific_objectives.map(String)
      : [
          `define and explain the meaning of ${topic.toLowerCase()}`,
          `identify and describe the main components of ${topic.toLowerCase()}`,
          `apply knowledge of ${topic.toLowerCase()} to solve class exercises`,
        ],
    rationale: String(parsed.rationale || `To equip ${className} learners with foundational and practical understanding of ${topic} in ${subject} in accordance with the NERDC curriculum.`),
    previous_knowledge: String(parsed.previous_knowledge || `Learners have encountered basic introductory concepts related to ${subject} in previous lessons and daily life.`),
    instructional_materials: Array.isArray(parsed.instructional_materials) && parsed.instructional_materials.length > 0
      ? parsed.instructional_materials.map(String)
      : [`NERDC ${subject} Textbook for ${className}`, "Charts and visual diagrams", "Whiteboard and markers", "Flashcards and realia"],
    reference_materials: Array.isArray(parsed.reference_materials) && parsed.reference_materials.length > 0
      ? parsed.reference_materials.map(String)
      : [`NERDC National Curriculum for ${subject} (${className})`, `Standard ${subject} Textbook & Workbook`],
    presentation,
    evaluation: Array.isArray(parsed.evaluation) && parsed.evaluation.length > 0
      ? parsed.evaluation.map(String)
      : Array.isArray(parsed.evaluation_questions) && parsed.evaluation_questions.length > 0
      ? parsed.evaluation_questions.map(String)
      : [
          `What is meant by ${topic}?`,
          `State three key features or components of ${topic}.`,
          `Give two practical examples of ${topic} in our daily environment.`,
          `Solve the classwork exercise on ${topic}.`,
        ],
    summary: String(parsed.summary || `The teacher reviews the key concepts of ${topic}, addresses learners' questions, and highlights the main takeaways on the board.`),
    assignment: Array.isArray(parsed.assignment) && parsed.assignment.length > 0
      ? parsed.assignment.map(String)
      : typeof parsed.homework === "string" && parsed.homework.trim()
      ? [parsed.homework.trim()]
      : [
          `Read the next section on ${topic} in your ${subject} textbook and answer exercises 1 to 4 in your workbook.`,
        ],
    lesson_note: String(parsed.lesson_note || parsed.board_summary || buildDefaultMarkdownBoardNote(topic, subject, className, subTopics)),
    video_searches: Array.isArray(parsed.video_searches) && parsed.video_searches.length > 0
      ? parsed.video_searches.map(String)
      : [
          `${topic} ${subject} lesson explained for ${className}`,
          `NERDC ${subject} ${topic} Nigerian curriculum`,
          `Practical examples of ${topic}`,
        ],
  };
}

function buildDefaultMarkdownBoardNote(topic: string, subject: string, className: string, subTopics: string[]): string {
  return [
    `# ${topic.toUpperCase()} (${subject} — ${className})`,
    "",
    `## 1. ${subTopics[0] || `Introduction to ${topic}`}`,
    `**${topic}** is an essential concept in **${subject}** designed to help learners understand how core principles operate in both academic study and everyday Nigerian contexts.`,
    "",
    `- **Definition**: ${topic} refers to the structured study, classification, and practical application of key principles within ${subject}.`,
    `- **Importance**: Mastering ${topic} builds analytical thinking and prepares learners for continuous assessment and national examinations.`,
    "",
    `## 2. ${subTopics[1] || `Core Components and Principles of ${topic}`}`,
    `1. **Foundational Elements**: Identifying the primary parts, terms, and rules governing ${topic}.`,
    `2. **Step-by-Step Process**: Following the systematic rules required to analyze or solve problems in ${topic}.`,
    `3. **Nigerian Context & Examples**: Applying ${topic} to real-life situations across Nigerian homes, markets, schools, and communities.`,
    "",
    `## 3. ${subTopics[2] || `Worked Examples & Practical Application`}`,
    `- **Example 1**: Identify the main features of ${topic} from the classroom chart and explain their functions.`,
    `- **Example 2**: Demonstrate how ${topic} is applied when solving standard ${className} ${subject} exercises.`,
    "",
    `## 4. Key Takeaways`,
    `- Always state definitions clearly using accurate ${subject} terminology.`,
    `- Show all working steps and label diagrams neatly in your exercise book.`,
  ].join("\n");
}

/**
 * Deterministic NERDC-compliant lesson plan & board note generator used as a resilient
 * fallback when AI API keys are unconfigured or credits/quotas are temporarily exhausted.
 */
export function buildFallbackNerdcLessonPlan(params: {
  topic: string;
  subject: string;
  class_name: string;
  extra?: string;
}): LessonPlan {
  const topic = params.topic.trim() || "General Topic";
  const subject = params.subject.trim() || "General Studies";
  const className = params.class_name.trim() || "Basic Class";

  const subTopics = [
    `Meaning and Definition of ${topic}`,
    `Key Features and Classification of ${topic}`,
    `Practical Examples and Application of ${topic}`,
    `Class Exercises and Review on ${topic}`,
  ];

  return {
    sub_topics: subTopics,
    specific_objectives: [
      `define and explain the meaning of ${topic} in their own words`,
      `identify and list at least three major features or types of ${topic}`,
      `demonstrate practical examples of ${topic} within the Nigerian environment`,
      `solve standard ${className} exercises on ${topic} accurately`,
    ],
    rationale: `This lesson introduces ${className} learners to ${topic} in ${subject}, building critical problem-solving skills and aligning with the NERDC curriculum standards.${params.extra ? ` (${params.extra})` : ""}`,
    previous_knowledge: `Learners are familiar with foundational topics in ${subject} from their previous lessons and everyday observations at home and school.`,
    instructional_materials: [
      `Approved NERDC ${subject} Textbook for ${className}`,
      `Illustrated wall chart showing ${topic}`,
      "Whiteboard, coloured markers, and flashcards",
      "Learner workbooks and realia",
    ],
    reference_materials: [
      `NERDC National Curriculum Guide for ${subject} (${className})`,
      `Comprehensive ${subject} for Nigerian Schools (${className})`,
    ],
    presentation: [
      {
        stage: "INTRODUCTION",
        teacher_activities: `Arouses learners' interest by asking questions based on their previous knowledge and linking their responses to the new topic: "${topic}".`,
        learning_activities: "Respond to the teacher's questions, share real-life observations, and copy the topic into their notebooks.",
        learning_point: `Linking prior knowledge to ${topic}.`,
      },
      {
        stage: "STEP I",
        teacher_activities: `Defines and explains the meaning of ${topic} clearly on the board using relevant Nigerian examples.`,
        learning_activities: "Listen attentively, repeat key terms, and ask clarifying questions.",
        learning_point: `Clear definition and concept of ${topic}.`,
      },
      {
        stage: "STEP II",
        teacher_activities: `Displays the instructional chart and guides learners through the main components, rules, and classifications of ${topic}.`,
        learning_activities: "Observe the instructional materials, identify key features in groups, and take structured notes.",
        learning_point: `Core features and structure of ${topic}.`,
      },
      {
        stage: "STEP III",
        teacher_activities: `Demonstrates worked examples and practical applications of ${topic} on the board, then supervises learners' practice.`,
        learning_activities: "Follow the worked examples step-by-step and solve practice questions in their exercise books.",
        learning_point: `Mastery and application of ${topic}.`,
      },
      {
        stage: "CONCLUSION",
        teacher_activities: `Summarizes the lesson highlights, evaluates learners with oral and written questions, and marks learners' notebooks.`,
        learning_activities: "Answer evaluation questions, copy the board summary, and submit notebooks for marking.",
        learning_point: `Consolidation and verification of learning objectives.`,
      },
    ],
    evaluation: [
      `Define ${topic} in your own words.`,
      `List three important features or components of ${topic}.`,
      `Explain two practical applications of ${topic} in everyday life.`,
      `Complete the classwork exercise on ${topic} on the board.`,
    ],
    summary: `In today's lesson, we explored the meaning, key components, and practical applications of ${topic} in ${subject}.`,
    assignment: [
      `Review the board notes on ${topic} and provide three additional examples in your ${subject} notebook.`,
      `Complete the end-of-topic exercise on ${topic} in your ${className} ${subject} workbook.`,
    ],
    lesson_note: buildDefaultMarkdownBoardNote(topic, subject, className, subTopics),
    video_searches: [
      `${topic} ${subject} lesson for ${className}`,
      `NERDC ${subject} ${topic} explained`,
      `${topic} examples for Nigerian students`,
    ],
  };
}
