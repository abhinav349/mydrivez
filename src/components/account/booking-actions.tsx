"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cancelBookingAction, submitReviewAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn, formatINR } from "@/lib/utils";

export function CancelBooking({ bookingId, policy }: { bookingId: string; policy: { rule: string; total: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Change of plans");
  const [other, setOther] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger-ghost" onClick={() => setOpen(true)}>
        Cancel booking
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancel this booking?" description="This can't be undone.">
        <div className="space-y-4">
          <div className="rounded-xl bg-paper p-4 text-[14px]">
            <p className="font-semibold text-ink">Estimated refund: {formatINR(policy.total)}</p>
            <p className="mt-1 text-muted">{policy.rule}. Security deposit is always refunded in full.</p>
          </div>
          <Field label="Reason" name="reason">
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Change of plans", "Found a better price", "Trip postponed", "Booked by mistake", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          {reason === "Other" && <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Tell us more" className="min-h-[80px]" />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelBookingAction(bookingId, reason === "Other" ? other || "Other" : reason);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.data.refundAmount ? `Cancelled. ${formatINR(r.data.refundAmount)} refund initiated.` : "Booking cancelled.");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Confirm cancellation
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitReviewAction({ bookingId, rating, title, comment });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Thanks! You earned 50 bonus points. Your review will appear once approved.");
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}>
            <Star className={cn("h-8 w-8 transition-transform hover:scale-110", (hover || rating) >= i ? "fill-amber-400 text-amber-400" : "fill-ink/10 text-transparent")} />
          </button>
        ))}
      </div>
      <Field label="Headline (optional)" name="title">
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Sum up your trip" />
      </Field>
      <Field label="Your review" name="comment">
        <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} placeholder="How was the car, pickup and the drive?" />
      </Field>
      <Button type="submit" loading={pending} disabled={!rating || comment.trim().length < 10}>
        Submit review
      </Button>
    </form>
  );
}
