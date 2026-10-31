import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { cloudinaryEnabled, emailEnabled, env, razorpayEnabled } from "@/lib/env";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { LocationForm, LocationToggle, SettingsForm } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireStaffPage();
  if (me.role !== "ADMIN") redirect("/admin?denied=1");
  const [settings, locations] = await Promise.all([getSettings(), db.vehicleLocation.findMany({ include: { city: true, _count: { select: { vehicles: true } } }, orderBy: [{ city: { name: "asc" } }, { name: "asc" }] })]);
  const integrations = [
    ["Razorpay payments", razorpayEnabled, razorpayEnabled ? (env.razorpay.keyId!.startsWith("rzp_test_") ? "Test mode" : "Live") : env.demoMode ? "Not configured — demo sandbox active" : "Not configured", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET"],
    ["Email (Resend)", emailEnabled, emailEnabled ? "Sending" : "Not configured — emails are logged only", "RESEND_API_KEY, EMAIL_FROM"],
    ["Cloudinary media", cloudinaryEnabled, cloudinaryEnabled ? "Public media uploads to Cloudinary" : "Using built-in database storage", "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"],
    ["SMS / WhatsApp (Twilio)", Boolean(env.sms.twilioSid), env.sms.twilioSid ? "Connected" : "Not configured — in-app + email only", "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM"],
    ["Scheduled reminders", Boolean(env.cronSecret), env.cronSecret ? "Daily via Vercel Cron" : "Set CRON_SECRET to enable", "CRON_SECRET"],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Platform rules, pickup hubs and integrations." />
      <Panel title="Booking & pricing rules">
        <div className="p-5">
          <SettingsForm settings={settings} />
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Pickup hubs & cities">
          <ul className="divide-y divide-line text-[13.5px]">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink">
                    {l.name} · {l.city.name} {!l.isActive && <Badge>Disabled</Badge>}
                  </p>
                  <p className="text-[12px] text-muted">
                    {l.address} · {l._count.vehicles} cars
                  </p>
                </div>
                <LocationToggle id={l.id} active={l.isActive} />
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5">
            <p className="mb-3 text-[13px] font-semibold text-ink">Add a hub (new cities are created automatically)</p>
            <LocationForm />
          </div>
        </Panel>
        <Panel title="Integrations">
          <ul className="divide-y divide-line">
            {integrations.map(([name, on, status, vars]) => (
              <li key={name} className="flex gap-3 px-5 py-4">
                {on ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{name}</p>
                  <p className="text-[13px] text-muted">{status}</p>
                  <p className="mt-1 break-words font-mono text-[11px] text-muted">{vars}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
