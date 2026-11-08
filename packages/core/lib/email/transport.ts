import "server-only";

import nodemailer from "nodemailer";

import { getBackend } from "@repo/core/backend/index";
import type { SmtpSettings } from "@repo/core/lib/email/templates";
import { getSecret } from "@repo/core/lib/secrets";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Sends one email through the store's SMTP server (Settings → Email sending) and records it in
// the email log. Never throws: a mail problem must not break an order.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  order_id?: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

export function isSmtpConfigured(smtp: SmtpSettings): boolean {
  return Boolean(smtp.host && smtp.from_email);
}

// smtp + password → a transporter; also used by "Send test email" with unsaved values.
export function createTransport(smtp: SmtpSettings, password: string) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // tls = TLS from the first byte (465); starttls = upgrade after connecting (587).
    secure: smtp.security === "tls",
    requireTLS: smtp.security === "starttls",
    auth: smtp.username ? { user: smtp.username, pass: password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function fromAddress(smtp: SmtpSettings, store_name: string): string {
  const name = (smtp.from_name || store_name).replace(/["\r\n]/g, "");
  return `"${name}" <${smtp.from_email}>`;
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const [smtp, store_name, password] = await Promise.all([
    getSiteSetting("SMTP"),
    getSiteSetting("SITE_NAME"),
    getSecret("SMTP_PASSWORD"),
  ]);
  const base = {
    template: email.template,
    recipient: email.to,
    subject: email.subject,
    order_id: email.order_id ?? "",
  };
  const log = getBackend().email_log;

  if (!isSmtpConfigured(smtp)) {
    await log.log({ ...base, status: "skipped", error: "smtp_not_configured" }).catch(() => undefined);
    return { ok: false, error: "smtp_not_configured" };
  }
  try {
    await createTransport(smtp, password).sendMail({
      from: fromAddress(smtp, store_name),
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    await log.log({ ...base, status: "sent", error: "" }).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
    await reportError("email", `send ${email.template}`, error);
    await log.log({ ...base, status: "failed", error: message }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
