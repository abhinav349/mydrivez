"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { createTicketAction, replyTicketAction } from "@/app/actions/customer";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionState } from "@/lib/validators";

export function NewTicketForm({ bookings, defaultBooking }: { bookings: { id: string; label: string }[]; defaultBooking?: string }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(createTicketAction, {});
  const fe = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok && state.data?.id) {
      toast.success("Ticket created. We usually reply within 30 minutes.");
      router.push(`/dashboard/support/${state.data.id}`);
    }
  }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Subject" name="subject" error={fe.subject}>
        <Input id="subject" name="subject" placeholder="Briefly, what do you need help with?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category" name="category">
          <Select id="category" name="category" defaultValue={defaultBooking ? "BOOKING" : "OTHER"}>
            {[["BOOKING", "Booking"], ["PAYMENT", "Payment & refunds"], ["VEHICLE", "Vehicle issue"], ["DOCUMENTS", "Documents"], ["ACCOUNT", "Account"], ["OTHER", "Something else"]].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" name="priority">
          <Select id="priority" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent — I&apos;m on a trip</option>
          </Select>
        </Field>
        <Field label="Related booking" name="bookingId">
          <Select id="bookingId" name="bookingId" defaultValue={defaultBooking ?? ""}>
            <option value="">None</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Message" name="message" error={fe.message}>
        <Textarea id="message" name="message" placeholder="Share as much detail as you can" className="min-h-[140px]" />
      </Field>
      <SubmitButton pendingText="Submitting…">Submit ticket</SubmitButton>
    </form>
  );
}

export function ReplyForm({ ticketId, action: serverAction }: { ticketId: string; action?: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(serverAction ?? replyTicketAction, {});
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 focus-within:ring-4 focus-within:ring-lime/40">
        <textarea name="body" rows={2} required placeholder="Write a reply…" className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none" />
        <SubmitButton size="icon" className="h-11 w-11">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </SubmitButton>
      </div>
      {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
    </form>
  );
}
