import "server-only";

const SLACK_ERROR_WEBHOOK = process.env.SLACK_ERROR_WEBHOOK;

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    // Not serializable (circular or exotic): fall back to its string form.
    return String(error);
  }
}

// Logs an unexpected error and posts it to Slack when SLACK_ERROR_WEBHOOK is set.
// Never send the raw error to the client: return fail("generic") instead.
export async function reportError(module: string, context: string, error: unknown): Promise<void> {
  const message = `[${module}] ${context}: ${describe(error)}`;
  console.error(message, error);

  if (!SLACK_ERROR_WEBHOOK) return;
  try {
    await fetch(SLACK_ERROR_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (slack_error) {
    console.error("[server-log] Slack webhook failed", slack_error);
  }
}

export function logWarning(module: string, message: string): void {
  console.warn(`[${module}] ${message}`);
}
