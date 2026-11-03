/** Report card data shared by the report sheet designs, PDFs and parent portal. */
export type SchoolReport = {
  schools?: { name?: string; logo_url?: string | null; motto?: string | null; address?: string | null; report_template?: unknown; principal_signature_url?: string | null; stamp_url?: string | null; principal_name?: string | null };
  students?: { first_name?: string; middle_name?: string | null; last_name?: string; admission_no?: string; gender?: string; dob?: string | null; photo_url?: string | null };
  classes?: { name?: string; arm?: string | null; section?: string | null };
  session?: string | null; term?: string | null; position?: number | null; class_size?: number | null;
  days_present?: number | null; days_absent?: number | null; days_total?: number | null;
  teacher_remark?: string | null; principal_remark?: string | null; verification_code?: string | null;
  affective?: Record<string, number | null>; psychomotor?: Record<string, number | null>;
};
