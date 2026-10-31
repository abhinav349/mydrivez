"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import {
  adminLoginAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendOtpAction,
  resetPasswordAction,
  verifyOtpAction,
} from "@/app/actions/auth";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionState } from "@/lib/validators";

function PasswordInput({ name, id, invalid, autoComplete, placeholder }: { name: string; id: string; invalid?: boolean; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} aria-invalid={invalid} placeholder={placeholder} className="pr-11" required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, portal = "customer", notice }: { next?: string; portal?: "customer" | "admin"; notice?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(portal === "admin" ? adminLoginAction : loginAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && <div className="rounded-xl bg-success-soft px-4 py-3 text-[13.5px] font-medium text-success">{notice}</div>}
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={portal === "admin" ? "Work email" : "Email or mobile number"} name="identifier" error={fe.identifier}>
        <Input id="identifier" name="identifier" autoComplete="username" placeholder={portal === "admin" ? "you@mydrivez.in" : "you@example.com or 98765 43210"} aria-invalid={!!fe.identifier} required />
      </Field>
      <Field label="Password" name="password" error={fe.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!fe.password} />
      </Field>
      <div className="flex items-center justify-between">
        <Checkbox name="remember" label="Remember me for 30 days" />
        {portal === "customer" && (
          <Link href="/forgot-password" className="text-[13px] font-semibold text-ink hover:underline">
            Forgot password?
          </Link>
        )}
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next, referral }: { next?: string; referral?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(registerAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" name="name" error={fe.name}>
        <Input id="name" name="name" autoComplete="name" placeholder="As on your driving licence" aria-invalid={!!fe.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" error={fe.email}>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!fe.email} required />
        </Field>
        <Field label="Mobile number" name="phone" error={fe.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={!!fe.phone} required />
        </Field>
      </div>
      <Field label="Password" name="password" error={fe.password} hint="8+ characters with a letter and a number">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} />
      </Field>
      <Field label="Confirm password" name="confirmPassword" error={fe.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" invalid={!!fe.confirmPassword} />
      </Field>
      <Field label="Referral code (optional)" name="referralCode" error={fe.referralCode}>
        <Input id="referralCode" name="referralCode" defaultValue={referral} placeholder="e.g. PRIYA482" className="uppercase" />
      </Field>
      <div>
        <Checkbox
          name="acceptTerms"
          label={
            <>
              I agree to the{" "}
              <Link href="/legal/terms" className="font-semibold underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="font-semibold underline">
                Privacy Policy
              </Link>
            </>
          }
        />
        {fe.acceptTerms && <p className="mt-1 text-[12.5px] font-medium text-danger">{fe.acceptTerms}</p>}
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function OtpForm({ email, next }: { email: string; next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(verifyOtpAction, {});
  const [resend, setResend] = useState<ActionState>({});
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lime">
        <MailCheck className="h-5 w-5" />
      </div>
      <h1 className="text-[28px] font-semibold tracking-[-0.035em]">Check your inbox</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>.
      </p>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Verification code" name="code" error={state.fieldErrors?.code}>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" className="h-14 text-center font-mono text-2xl tracking-[0.5em]" required />
        </Field>
        <FormError message={state.error} />
        <SubmitButton size="lg" className="w-full" pendingText="Verifying…">
          Verify email
        </SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-center text-[13.5px] text-muted">
        <p>
          Didn&apos;t get it?{" "}
          <button disabled={pending} onClick={() => start(async () => setResend(await resendOtpAction()))} className="font-semibold text-ink hover:underline disabled:opacity-50">
            Resend code
          </button>
        </p>
        {resend.message && <p className="rounded-lg bg-paper px-3 py-2 font-medium text-ink">{resend.message}</p>}
        {resend.error && <p className="font-medium text-danger">{resend.error}</p>}
        <p>
          <Link href={next || "/dashboard"} className="hover:text-ink hover:underline">
            Skip for now
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction, {});
  if (state.ok)
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-success-soft px-4 py-3 text-[14px] font-medium text-success">{state.message}</div>
        {typeof state.data?.demoLink === "string" && (
          <p className="rounded-xl bg-paper px-4 py-3 text-[13px] text-muted">
            Demo mode (no email provider configured):{" "}
            <Link href={state.data.demoLink} className="font-semibold text-ink underline">
              open reset link
            </Link>
          </p>
        )}
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" error={fe.password} hint="8+ characters with a letter and a number">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} />
      </Field>
      <Field label="Confirm new password" name="confirmPassword" error={fe.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" invalid={!!fe.confirmPassword} />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
