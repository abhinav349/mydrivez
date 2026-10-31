import "server-only";
import { env, emailEnabled } from "./env";
import { BRAND } from "./constants";

export type EmailMessage = { to: string; subject: string; heading: string; body: string; cta?: { label: string; url: string } };

function render(m: EmailMessage) {
  const cta = m.cta
    ? `<p style="margin:28px 0"><a href="${m.cta.url}" style="background:#101820;color:#C6F36B;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${m.cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:Inter,Arial,sans-serif;color:#20242A">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#101820;padding:22px 32px;color:#fff;font-size:20px;font-weight:700;letter-spacing:-.02em">My<span style="color:#C6F36B">Drivez</span></td></tr>
  <tr><td style="padding:32px"><h1 style="font-size:22px;margin:0 0 12px">${m.heading}</h1>
  <div style="font-size:15px;line-height:1.6;color:#4a5260">${m.body}</div>${cta}</td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#8a919c">${BRAND.name} · ${BRAND.address}</td></tr>
  </table></td></tr></table></body></html>`;
}

/**
 * Sends via Resend when RESEND_API_KEY is set; otherwise logs to the server console.
 * Returns whether a real email was sent.
 */
export async function sendEmail(m: EmailMessage): Promise<boolean> {
  if (!emailEnabled) {
    console.info(`[email:disabled] to=${m.to} subject="${m.subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resend.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.resend.from, to: [m.to], subject: m.subject, html: render(m) }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
