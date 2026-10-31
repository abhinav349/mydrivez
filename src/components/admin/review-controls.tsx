"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { moderateReview, reviewDocument, setCustomerStatus } from "@/app/actions/admin-misc";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Select, Textarea } from "@/components/ui/field";

type Res = { ok: true } | { ok: false; error: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    act: (fn: () => Promise<Res>, msg: string, after?: () => void) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) return void toast.error(r.error);
        toast.success(msg);
        after?.();
        router.refresh();
      }),
  };
}

const REJECT_REASONS = ["Image is blurry or unreadable", "Document has expired", "Name doesn't match the account", "Wrong document type uploaded", "Other"];

export function DocumentDecision({ id }: { id: string }) {
  const { pending, act } = useAct();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [other, setOther] = useState("");
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="accent" loading={pending} onClick={() => act(() => reviewDocument(id, "VERIFIED"), "Document verified — customer notified")}>
        <Check className="h-4 w-4" /> Approve
      </Button>
      <Button size="sm" variant="danger-ghost" onClick={() => setOpen(true)}>
        <X className="h-4 w-4" /> Reject
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Reject document" description="The customer will see this reason and be asked to re-upload.">
        <div className="space-y-4">
          <Field label="Reason" name="reason">
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REJECT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          {reason === "Other" && <Textarea value={other} onChange={(e) => setOther(e.target.value)} className="min-h-[80px]" />}
          <div className="flex justify-end">
            <Button variant="danger" loading={pending} onClick={() => act(() => reviewDocument(id, "REJECTED", reason === "Other" ? other : reason), "Document rejected", () => setOpen(false))}>
              Reject document
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function ReviewDecision({ id, status }: { id: string; status: string }) {
  const { pending, act } = useAct();
  return (
    <div className="flex gap-1.5">
      {status !== "APPROVED" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => moderateReview(id, "APPROVED"), "Review published")}>
          <Check className="h-4 w-4" /> Publish
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button size="sm" variant="danger-ghost" disabled={pending} onClick={() => act(() => moderateReview(id, "REJECTED"), "Review hidden")}>
          <X className="h-4 w-4" /> Hide
        </Button>
      )}
    </div>
  );
}

export function SuspendToggle({ id, status }: { id: string; status: string }) {
  const { pending, act } = useAct();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (status === "SUSPENDED")
    return (
      <Button variant="secondary" loading={pending} onClick={() => act(() => setCustomerStatus(id, "ACTIVE"), "Account reactivated")}>
        Reactivate account
      </Button>
    );
  return (
    <>
      <Button variant="danger-ghost" onClick={() => setOpen(true)}>
        Suspend account
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Suspend this customer?" description="They'll be signed out everywhere and can't sign in or book until reactivated.">
        <div className="space-y-4">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Internal reason (logged)" className="min-h-[80px]" />
          <div className="flex justify-end">
            <Button variant="danger" loading={pending} onClick={() => act(() => setCustomerStatus(id, "SUSPENDED", reason), "Account suspended", () => setOpen(false))}>
              Suspend
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
