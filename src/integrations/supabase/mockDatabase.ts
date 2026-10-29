// Compatibility transport: an unavailable backend must never fabricate accounts or records.
export async function mockPostgrestFetch(
  _input: RequestInfo | URL,
  _init?: RequestInit,
): Promise<Response> {
  return new Response(JSON.stringify({
    code: "BACKEND_NOT_CONFIGURED",
    message: "The school service is unavailable. No records were saved.",
  }), { status: 503, headers: { "Content-Type": "application/json" } });
}
