export type ErrorContext = "auth" | "query" | "schema";

function extractStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/\((\d{3})\)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function getFriendlyError(context: ErrorContext, error: unknown): string {
  const status = extractStatusCode(error);

  if (context === "auth") {
    if (status === 401) return "Sign-in failed. Please try again.";
    if (status === 429) return "Too many sign-in attempts. Please wait a moment and retry.";
    if (status !== null && status >= 500) return "Sign-in is temporarily unavailable. Please try again shortly.";
    return "Google sign-in failed. Please try again.";
  }

  if (context === "schema") {
    if (status === 429) return "Schema loading is temporarily rate-limited. Please retry in a few seconds.";
    if (status !== null && status >= 500) return "Schema service is warming up. Please wait a moment and retry.";
    return "Could not load schema right now. Please try again.";
  }

  if (status === 401) return "Your session expired. Please log in again.";
  if (status === 402) return "You do not have enough credits for this query.";
  if (status === 429) return "Too many requests right now. Please wait a few seconds and retry.";
  if (status === 400) return "That question could not be processed. Please rephrase and try again.";
  if (status !== null && status >= 500) return "The backend is warming up or temporarily unavailable. Please try again shortly.";
  return "Something went wrong while running your query. Please try again.";
}
