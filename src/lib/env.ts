import "server-only";
import { siteUrl } from "./site-url";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

// AUTH_SECRET is enforced where it's used (src/lib/auth/jwt.ts), at request time rather than at
// import, so `next build` doesn't need runtime secrets.

export const env = {
  appUrl: siteUrl(),
  /** When true, demo helpers (simulated payments, on-screen OTP codes) are enabled where no real provider is configured. */
  // Defaults to ON for the zero-setup demo deployment (no DATABASE_URL); set DEMO_MODE explicitly to override.
  demoMode: optional("DEMO_MODE") ? optional("DEMO_MODE") === "true" : !optional("DATABASE_URL"),
  cronSecret: optional("CRON_SECRET"),
  razorpay: {
    keyId: optional("RAZORPAY_KEY_ID"),
    keySecret: optional("RAZORPAY_KEY_SECRET"),
    webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"),
  },
  stripe: {
    secretKey: optional("STRIPE_SECRET_KEY"),
  },
  resend: {
    apiKey: optional("RESEND_API_KEY"),
    from: optional("EMAIL_FROM") ?? "MyDrivez <no-reply@mydrivez.example>",
  },
  cloudinary: {
    cloudName: optional("CLOUDINARY_CLOUD_NAME"),
    apiKey: optional("CLOUDINARY_API_KEY"),
    apiSecret: optional("CLOUDINARY_API_SECRET"),
  },
  sms: {
    twilioSid: optional("TWILIO_ACCOUNT_SID"),
    twilioToken: optional("TWILIO_AUTH_TOKEN"),
    twilioFrom: optional("TWILIO_FROM_NUMBER"),
    whatsappFrom: optional("TWILIO_WHATSAPP_FROM"),
  },
};

export const razorpayEnabled = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
export const cloudinaryEnabled = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
export const emailEnabled = Boolean(env.resend.apiKey);
/** Simulated payments are only offered when no real gateway is configured AND demo mode is on. */
export const demoPaymentsEnabled = !razorpayEnabled && env.demoMode;
