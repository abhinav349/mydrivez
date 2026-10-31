import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { AvatarForm, PasswordForm, ProfileForm } from "@/components/account/profile-forms";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "My profile" };

const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : "");

export default async function ProfilePage() {
  const user = await requireCustomerPage();
  const p = await db.customerProfile.findUnique({ where: { userId: user.id } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">My profile</h1>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <AvatarForm name={user.name} src={user.avatarUrl} />
        <div className="flex items-center gap-2">
          {user.emailVerified ? <Badge tone="success" dot>Email verified</Badge> : <LinkButton href="/verify-email?next=/dashboard/profile" size="sm" variant="secondary">Verify email</LinkButton>}
          <LinkButton href="/dashboard/documents" size="sm" variant="secondary">
            Manage documents
          </LinkButton>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <ProfileForm
            data={{
              name: user.name,
              phone: user.phone ?? "",
              email: user.email,
              dateOfBirth: d(p?.dateOfBirth),
              addressLine1: p?.addressLine1 ?? "",
              addressLine2: p?.addressLine2 ?? "",
              city: p?.city ?? "",
              state: p?.state ?? "",
              pincode: p?.pincode ?? "",
              licenseNumber: p?.licenseNumber ?? "",
              licenseExpiry: d(p?.licenseExpiry),
              licenseState: p?.licenseState ?? "",
              emergencyName: p?.emergencyName ?? "",
              emergencyPhone: p?.emergencyPhone ?? "",
            }}
          />
        </section>
        <section className="card h-fit p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Change password</h2>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
