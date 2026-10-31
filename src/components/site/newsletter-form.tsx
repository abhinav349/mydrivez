"use client";

import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { subscribeNewsletter } from "@/app/actions/public";
import { SubmitButton } from "@/components/ui/submit";

export function NewsletterForm() {
  const [state, action] = useActionState(subscribeNewsletter, {});
  if (state.ok)
    return (
      <p className="flex items-center gap-2 text-sm text-lime">
        <Check className="h-4 w-4" /> {state.message}
      </p>
    );
  return (
    <form action={action} className="flex max-w-md gap-2">
      <label htmlFor="nl-email" className="sr-only">
        Email address
      </label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 focus:border-lime/60 focus:outline-none"
      />
      <SubmitButton variant="accent" className="h-11 px-4" pendingText="">
        <ArrowRight className="h-4 w-4" />
        <span className="sr-only">Subscribe</span>
      </SubmitButton>
      {state.error && <p className="text-xs text-red-300">{state.error}</p>}
    </form>
  );
}
