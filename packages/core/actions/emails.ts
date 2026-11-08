"use server";

import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, EmailLogEntry, Page } from "@repo/core/backend/types";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { renderEmail } from "@repo/core/lib/email/layout";
import { buildOrderEmail } from "@repo/core/lib/email/order-emails";
import {
  DEFAULT_TEMPLATES,
  EMAIL_TEMPLATES,
  notifications_schema,
  smtp_schema,
  template_settings_schema,
  templateSettings,
  type EmailTemplate,
  type NotificationSettings,
  type SmtpSettings,
  type TemplateSettings,
} from "@repo/core/lib/email/templates";
import { createTransport, fromAddress, isSmtpConfigured, sendEmail } from "@repo/core/lib/email/transport";
import { order_list_filters_schema } from "@repo/core/lib/schemas/orders";
import { canStoreSecrets, getSecret, saveSecret, secretStatus, type SecretStatus } from "@repo/core/lib/secrets";
import { SITE_SETTINGS } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Settings → Email sending (SMTP) and Settings → Notifications (templates, staff addresses, log).

export type EmailSendingOverview = {
  smtp: SmtpSettings;
  password: SecretStatus;
  can_store_secrets: boolean;
  is_configured: boolean;
};

export async function getEmailSending(): Promise<ActionResult<EmailSendingOverview>> {
  const auth = await authorize("settings.view", "view email settings");
  if (!auth.ok) return auth;
  try {
    const [settings, secrets] = await Promise.all([getSiteSettings(), secretStatus()]);
    return ok({
      smtp: settings.SMTP,
      password: secrets.SMTP_PASSWORD,
      can_store_secrets: canStoreSecrets(),
      is_configured: isSmtpConfigured(settings.SMTP),
    });
  } catch (error) {
    return failFrom(error, "emails", "getEmailSending");
  }
}

const save_smtp_schema = z.object({
  smtp: smtp_schema,
  // undefined = keep the saved password; "" = remove it.
  password: z.string().max(500).optional(),
});
export type SaveSmtpInput = z.input<typeof save_smtp_schema>;

export async function saveSmtp(input: SaveSmtpInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the email settings");
  if (!auth.ok) return auth;
  const parsed = save_smtp_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  if (parsed.data.password && !canStoreSecrets()) return fail("secrets_unavailable");

  try {
    const definition = SITE_SETTINGS.SMTP;
    await getBackend().settings.save({
      key: "SMTP",
      category: definition.category,
      value: parsed.data.smtp,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    if (parsed.data.password !== undefined)
      await saveSecret("SMTP_PASSWORD", parsed.data.password, auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the email settings",
      target_type: "settings",
      details: { host: parsed.data.smtp.host, password_changed: parsed.data.password !== undefined },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "emails", "saveSmtp");
  }
}

// Sends a short test message with the SAVED settings, so what's tested is what orders will use.
export async function sendSmtpTest(input: { to: string }): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "send a test email");
  if (!auth.ok) return auth;
  const parsed = z.object({ to: z.email() }).safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const [settings, password] = await Promise.all([getSiteSettings(), getSecret("SMTP_PASSWORD")]);
    if (!isSmtpConfigured(settings.SMTP)) return fail("smtp_failed");
    const { html, text } = renderEmail({
      store_name: settings.SITE_NAME,
      logo_url: settings.SITE_LOGO_URL,
      accent_color: "#111111",
      contact_line: settings.SITE_CONTACT.email,
      subject: settings.SITE_NAME,
      body: `${settings.SITE_NAME}: SMTP ✓`,
    });
    await createTransport(settings.SMTP, password).sendMail({
      from: fromAddress(settings.SMTP, settings.SITE_NAME),
      to: parsed.data.to,
      subject: `${settings.SITE_NAME}: SMTP ✓`,
      html,
      text,
    });
    await getBackend()
      .email_log.log({
        template: "smtp_test",
        recipient: parsed.data.to,
        subject: "SMTP test",
        status: "sent",
        error: "",
        order_id: "",
      })
      .catch(() => undefined);
    return ok(null);
  } catch (error) {
    await getBackend()
      .email_log.log({
        template: "smtp_test",
        recipient: parsed.data.to,
        subject: "SMTP test",
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "error",
        order_id: "",
      })
      .catch(() => undefined);
    return fail("smtp_failed");
  }
}

// ---------- Notifications ----------

export type NotificationsOverview = {
  templates: Record<EmailTemplate, TemplateSettings>;
  defaults: Record<EmailTemplate, TemplateSettings>;
  staff_recipients: string[];
  abandoned_delay_hours: number;
  is_smtp_configured: boolean;
};

export async function getNotifications(): Promise<ActionResult<NotificationsOverview>> {
  const auth = await authorize("settings.view", "view notifications");
  if (!auth.ok) return auth;
  try {
    const settings = await getSiteSettings();
    return ok({
      templates: Object.fromEntries(
        EMAIL_TEMPLATES.map((template) => [template, templateSettings(settings.NOTIFICATIONS, template)]),
      ) as Record<EmailTemplate, TemplateSettings>,
      defaults: DEFAULT_TEMPLATES,
      staff_recipients: settings.NOTIFICATIONS.staff_recipients,
      abandoned_delay_hours: settings.NOTIFICATIONS.abandoned_delay_hours,
      is_smtp_configured: isSmtpConfigured(settings.SMTP),
    });
  } catch (error) {
    return failFrom(error, "emails", "getNotifications");
  }
}

export async function saveNotifications(input: NotificationSettings): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "edit notifications");
  if (!auth.ok) return auth;
  const parsed = notifications_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const definition = SITE_SETTINGS.NOTIFICATIONS;
    await getBackend().settings.save({
      key: "NOTIFICATIONS",
      category: definition.category,
      value: parsed.data,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    await logActivity({ actor_id: auth.caller.user_id, action: "edit notifications", target_type: "settings" });
    return ok(null);
  } catch (error) {
    return failFrom(error, "emails", "saveNotifications");
  }
}

// The newest order, or a sample one when the store has none yet: what previews are built from.
async function previewOrder(): Promise<AdminOrderDetail> {
  const orders = getBackend().orders;
  const latest = await orders.list(order_list_filters_schema.parse({}), 1);
  if (latest.items[0]) return orders.get(latest.items[0].id);
  const settings = await getSiteSettings();
  return {
    id: "sample",
    order_number: 1001,
    created_at: new Date().toISOString(),
    status: "pending",
    payment_status: "unpaid",
    payment_method: settings.PAYMENT_METHODS[0]?.id ?? "cash_on_delivery",
    email: "customer@example.com",
    phone: "",
    locale: settings.DEFAULT_LOCALE,
    shipping_address: {
      full_name: "Alex Example",
      phone: "",
      line1: "1 Example Street",
      line2: "",
      city: "Rome",
      region: "",
      postal_code: "00100",
      country: "IT",
    },
    billing_address: null,
    shipping_method: "Standard",
    customer_note: "",
    internal_note: "",
    attribution: null,
    refunded_total: 0,
    refunds: [],
    gift_card_total: 0,
    checkout_session_id: "",
    tracking_number: "1Z999",
    carrier: "DHL",
    tracking_url: "https://example.com/track/1Z999",
    paid_at: "",
    shipped_at: "",
    delivered_at: "",
    cancelled_at: "",
    items: [],
    events: [],
    payments: [],
    customer: null,
    discount_code: "",
    currency: settings.CURRENCY,
    subtotal: 5900,
    discount_total: 0,
    shipping_total: 500,
    tax_total: 0,
    cod_fee: 0,
    total: 6400,
  };
}

const preview_schema = z.object({
  template: z.enum(EMAIL_TEMPLATES),
  locale: z.enum(LOCALES),
  config: template_settings_schema,
});
export type PreviewEmailInput = z.input<typeof preview_schema>;

export async function previewEmail(input: PreviewEmailInput): Promise<ActionResult<{ subject: string; html: string }>> {
  const auth = await authorize("settings.view", "preview an email");
  if (!auth.ok) return auth;
  const parsed = preview_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const email = await buildOrderEmail(parsed.data.template, await previewOrder(), {
      to: "preview@example.com",
      config: parsed.data.config,
      locale: parsed.data.locale as Locale,
      ignore_disabled: true,
      extra: { invoice_link: "https://example.com/invoice" },
    });
    return email ? ok({ subject: email.subject, html: email.html }) : fail("not_found");
  } catch (error) {
    return failFrom(error, "emails", "previewEmail");
  }
}

// Sends the template (as currently typed) to the signed-in staff member.
export async function sendTemplateTest(input: PreviewEmailInput): Promise<ActionResult<{ to: string }>> {
  const auth = await authorize("settings.edit", "send a test email");
  if (!auth.ok) return auth;
  const parsed = preview_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const order = await previewOrder();
    const email = await buildOrderEmail(parsed.data.template, order, {
      to: auth.caller.email,
      config: parsed.data.config,
      locale: parsed.data.locale as Locale,
      ignore_disabled: true,
      extra: { invoice_link: "https://example.com/invoice" },
    });
    if (!email) return fail("not_found");
    const result = await sendEmail({
      ...email,
      template: parsed.data.template,
      order_id: order.id === "sample" ? "" : order.id,
    });
    return result.ok ? ok({ to: email.to }) : fail("smtp_failed");
  } catch (error) {
    return failFrom(error, "emails", "sendTemplateTest");
  }
}

export async function getEmailLog(input: { page: number }): Promise<ActionResult<Page<EmailLogEntry>>> {
  const auth = await authorize("settings.view", "view the email log");
  if (!auth.ok) return auth;
  const page = z.number().int().min(1).max(10_000).catch(1).parse(input.page);
  try {
    return ok(await getBackend().email_log.list(page, 25));
  } catch (error) {
    return failFrom(error, "emails", "getEmailLog");
  }
}
