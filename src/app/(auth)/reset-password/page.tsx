import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Choose a new password</h1>
      <p className="mb-8 mt-2 text-[14.5px] text-muted">You&apos;ll be signed out of all other devices.</p>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-[14px] text-danger">
          This link is missing its token.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
          .
        </p>
      )}
    </>
  );
}
