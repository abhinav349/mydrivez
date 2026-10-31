import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "CUSTOMER" ? "/dashboard" : "/admin");
  return (
    <>
      <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Create your account</h1>
      <p className="mb-8 mt-2 text-[14.5px] text-muted">Takes 30 seconds. Use code FIRSTDRIVE for ₹500 off your first trip.</p>
      <RegisterForm next={sp.next} referral={sp.ref} />
      <p className="mt-8 text-center text-[14px] text-muted">
        Already have an account?{" "}
        <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-semibold text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
