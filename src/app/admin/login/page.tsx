import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/forms";
import { Logo } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && user.role !== "CUSTOMER") redirect("/admin");
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/10 blur-[140px]" />
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo dark />
          <p className="mt-6 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/60">
            <ShieldCheck className="h-3.5 w-3.5 text-lime" /> Operations console
          </p>
        </div>
        <div className="rounded-3xl bg-white p-7 shadow-lift sm:p-8">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Staff sign in</h1>
          <p className="mb-6 mt-1 text-[14px] text-muted">Authorised MyDrivez personnel only. All actions are logged.</p>
          <LoginForm portal="admin" />
        </div>
        <p className="mt-6 text-center text-[12.5px] text-white/40">
          Platform by{" "}
          <a href="https://ownwebify.com" target="_blank" rel="noopener" className="font-semibold text-white/70 hover:text-lime">
            OwnWebify
          </a>
        </p>
      </div>
    </div>
  );
}
