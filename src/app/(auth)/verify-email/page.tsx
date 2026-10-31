import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OtpForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const next = safeNext(sp.next, "/dashboard");
  if (user.emailVerified) redirect(next);
  return <OtpForm email={user.email} next={next} />;
}
