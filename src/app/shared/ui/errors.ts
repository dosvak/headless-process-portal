/** Human text for a failed engine call (the classic API answers {Data: {errorMessage}}; the v2 family {error_message}). */
export function errorText(e: unknown): string {
  const err = e as { status?: number; error?: any; message?: string };
  const body = err?.error;
  const msg = body?.Data?.errorMessage ?? body?.error_message ?? body?.errorMessage ?? (typeof body === 'string' ? body : null) ?? err?.message ?? 'Unknown error';
  return (err?.status ? `HTTP ${err.status}: ` : '') + String(msg).replace(/^CWTBG\d+E:\s*/, '').slice(0, 300);
}
