import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Forgot your password?</h1>
      <p className="mb-8 mt-2 text-[14.5px] text-muted">Enter your email and we&apos;ll send you a secure link to reset it.</p>
      <ForgotForm />
      <p className="mt-8 text-center text-[14px] text-muted">
        <Link href="/login" className="font-semibold text-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
