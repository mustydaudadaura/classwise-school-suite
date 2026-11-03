/** Report card data shared by the report sheet designs, PDFs and parent portal. */
export type SchoolReport = {
  schools?: { name?: string; logo_url?: string | null; motto?: string | null; address?: string | null; report_template?: unknown; principal_signature_url?: string | null; stamp_url?: string | null; principal_name?: string | null };
