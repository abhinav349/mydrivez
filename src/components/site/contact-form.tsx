"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitContact } from "@/app/actions/public";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionState } from "@/lib/validators";

export function ContactForm() {
  const [state, action] = useActionState<ActionState, FormData>(submitContact, {});
  if (state.ok)
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-lime-600" />
        <p className="mt-4 text-lg font-semibold text-ink">Message received</p>
        <p className="mt-1 max-w-sm text-[14px] text-muted">{state.message}</p>
      </div>
    );
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <FormError message={state.error} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Name" name="name" error={fe.name}>
        <Input id="name" name="name" autoComplete="name" />
      </Field>
      <Field label="Email" name="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Phone (optional)" name="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Subject" name="subject" error={fe.subject}>
        <Input id="subject" name="subject" placeholder="Corporate rentals, partnerships…" />
      </Field>
      <Field label="Message" name="message" error={fe.message} className="sm:col-span-2">
        <Textarea id="message" name="message" className="min-h-[140px]" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="lg" pendingText="Sending…">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
