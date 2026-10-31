"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markEnquiryHandled, updateTicket } from "@/app/actions/admin-misc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

export function TicketControls({ id, status, priority, assignedToId, staff }: { id: string; status: string; priority: string; assignedToId: string | null; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const update = (patch: Parameters<typeof updateTicket>[1]) =>
    start(async () => {
      const r = await updateTicket(id, patch);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Ticket updated");
      router.refresh();
    });
  return (
    <div className="space-y-3">
      <label className="block text-[12px] font-medium text-muted">
        Status
        <Select value={status} disabled={pending} onChange={(e) => update({ status: e.target.value })} className="mt-1 h-10">
          {["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
            </option>
          ))}
        </Select>
      </label>
      <label className="block text-[12px] font-medium text-muted">
        Priority
        <Select value={priority} disabled={pending} onChange={(e) => update({ priority: e.target.value })} className="mt-1 h-10">
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </label>
      <label className="block text-[12px] font-medium text-muted">
        Assigned to
        <Select value={assignedToId ?? ""} disabled={pending} onChange={(e) => update({ assignedToId: e.target.value || null })} className="mt-1 h-10">
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

export function HandledButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await markEnquiryHandled(id);
          if (r.ok) router.refresh();
        })
      }
    >
      Mark handled
    </Button>
  );
}
