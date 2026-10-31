import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "CUSTOMER" ? safeNext(sp.next, "/dashboard") : "/admin");
  return (
    <>
      <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Welcome back</h1>
      <p className="mb-8 mt-2 text-[14.5px] text-muted">Sign in to manage bookings and hit the road faster.</p>
      <LoginForm next={sp.next} notice={sp.reset ? "Password updated. Sign in with your new password." : undefined} />
      <p className="mt-8 text-center text-[14px] text-muted">
        New to MyDrivez?{" "}
        <Link href={`/register${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-semibold text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
