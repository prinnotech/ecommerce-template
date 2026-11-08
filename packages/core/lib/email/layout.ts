// The HTML around every email: the store's logo or name, the body, an optional order summary and
// the store's contact line. Email clients ignore stylesheets and CSS variables, so this is the
// one place with inline styles and literal colours (the accent comes from the live theme).

export type EmailSummary = {
  lines: { title: string; detail: string; quantity: number; amount: string }[];
  rows: { label: string; value: string }[];
  total: { label: string; value: string };
};

export type EmailContent = {
  store_name: string;
  logo_url: string;
  accent_color: string;
  contact_line: string;
  subject: string;
  body: string;
  summary?: EmailSummary;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Plain text → paragraphs, with web addresses made clickable (after escaping).
function bodyHtml(body: string, accent: string): string {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph)
        .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${accent};">${url}</a>`)
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px;line-height:1.55;">${html}</p>`;
    })
    .join("");
}

function summaryHtml(summary: EmailSummary): string {
  const lines = summary.lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;">${escapeHtml(line.title)}${
          line.detail ? `<br><span style="color:#777777;font-size:13px;">${escapeHtml(line.detail)}</span>` : ""
        }</td>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:center;color:#777777;">× ${line.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">${escapeHtml(line.amount)}</td>
      </tr>`,
    )
    .join("");
  const rows = summary.rows
    .map(
      (row) => `<tr><td colspan="2" style="padding:4px 0;color:#555555;">${escapeHtml(row.label)}</td>
        <td style="padding:4px 0;text-align:right;color:#555555;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;font-size:14px;">
    ${lines}${rows}
    <tr><td colspan="2" style="padding:10px 0 0;font-weight:600;">${escapeHtml(summary.total.label)}</td>
      <td style="padding:10px 0 0;text-align:right;font-weight:600;">${escapeHtml(summary.total.value)}</td></tr>
  </table>`;
}

function summaryText(summary: EmailSummary): string {
  return [
    ...summary.lines.map(
      (line) => `${line.title}${line.detail ? ` (${line.detail})` : ""} × ${line.quantity}: ${line.amount}`,
    ),
    "",
    ...summary.rows.map((row) => `${row.label}: ${row.value}`),
    `${summary.total.label}: ${summary.total.value}`,
  ].join("\n");
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const accent = /^#[0-9a-f]{6}$/i.test(content.accent_color) ? content.accent_color : "#111111";
  const header = content.logo_url
    ? `<img src="${escapeHtml(content.logo_url)}" alt="${escapeHtml(content.store_name)}" height="36" style="height:36px;width:auto;border:0;">`
    : `<span style="font-size:20px;font-weight:600;">${escapeHtml(content.store_name)}</span>`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:3px solid ${accent};">${header}</td></tr>
        <tr><td style="padding:28px;font-size:15px;">
          ${bodyHtml(content.body, accent)}
          ${content.summary ? summaryHtml(content.summary) : ""}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#fafafa;color:#777777;font-size:12px;line-height:1.5;">
          ${escapeHtml(content.store_name)}${content.contact_line ? ` · ${escapeHtml(content.contact_line)}` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    content.body,
    content.summary ? `\n${summaryText(content.summary)}` : "",
    `\n—\n${content.store_name}${content.contact_line ? ` · ${content.contact_line}` : ""}`,
  ].join("\n");
  return { html, text };
}
