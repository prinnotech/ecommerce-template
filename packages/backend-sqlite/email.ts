import "server-only";

// Transactional email for the built-in auth. Resend's HTTP API when RESEND_API_KEY and
// EMAIL_FROM are set; otherwise the message goes to the server log (development).
export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<void> {
  const api_key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!api_key || !from) {
    console.warn(
      `[email] RESEND_API_KEY / EMAIL_FROM not set. Email to ${message.to}: ${message.subject}\n${message.text}`,
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend: HTTP ${response.status} ${await response.text()}`);
}
