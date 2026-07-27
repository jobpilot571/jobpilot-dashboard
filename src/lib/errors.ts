/** Normalize Supabase / unknown thrown values into a readable message. */
export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const o = error as { message?: string; error_description?: string; details?: string; hint?: string };
    if (o.message) return o.message;
    if (o.error_description) return o.error_description;
    if (o.details) return o.details;
    if (o.hint) return o.hint;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export function toError(error: unknown, fallback = "Request failed"): Error {
  if (error instanceof Error) return error;
  return new Error(getErrorMessage(error, fallback));
}
