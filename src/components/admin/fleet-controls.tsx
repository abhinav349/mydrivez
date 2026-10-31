"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addMaintenanceAction, deleteVehicle, deleteVehicleImage, makePrimaryImage, setVehicleStatus, updateMaintenanceStatus, upsertVehicleDocument } from "@/app/actions/admin-fleet";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionState } from "@/lib/validators";

type Res = { ok: true } | { ok: false; error: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Res>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  return { pending, act };
}

export function StatusControls({ id, status }: { id: string; status: string }) {
  const { pending, act } = useAct();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "AVAILABLE" && status !== "RENTED" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => setVehicleStatus(id, "AVAILABLE"), "Car is now available")}>
          Activate
        </Button>
      )}
      {status === "AVAILABLE" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => setVehicleStatus(id, "MAINTENANCE"), "Marked under maintenance")}>
          Mark maintenance
        </Button>
      )}
      {status !== "INACTIVE" && status !== "RENTED" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => setVehicleStatus(id, "INACTIVE"), "Car deactivated")}>
          Deactivate
        </Button>
      )}
      <Button size="sm" variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this car?" description="Cars with booking history are retired (made inactive) instead, so records stay intact.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={async () => {
              const r = await deleteVehicle(id);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.retired ? "Car retired (has history)." : "Car deleted.");
              router.push("/admin/fleet");
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function ImageManager({ images }: { images: { id: string; url: string }[] }) {
  const { pending, act } = useAct();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((im, i) => (
        <div key={im.id} className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-paper">
          <Image src={im.url} alt="" fill sizes="200px" className="object-cover" />
          {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold text-lime">COVER</span>}
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {i > 0 && (
              <button disabled={pending} onClick={() => act(() => makePrimaryImage(im.id), "Cover photo updated")} className="rounded-md bg-white/95 p-1.5" aria-label="Make cover photo">
                <Star className="h-3.5 w-3.5" />
              </button>
            )}
            <button disabled={pending} onClick={() => act(() => deleteVehicleImage(im.id), "Photo removed")} className="rounded-md bg-white/95 p-1.5 text-danger" aria-label="Delete photo">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      {!images.length && <p className="col-span-full text-[13px] text-muted">No photos yet — add some in the form below.</p>}
    </div>
  );
}

export function DocumentRow({ vehicleId, type, number, expiresAt }: { vehicleId: string; type: "INSURANCE" | "PUC" | "REGISTRATION" | "FITNESS" | "PERMIT"; number: string; expiresAt: string }) {
  const { pending, act } = useAct();
  const [n, setN] = useState(number);
  const [d, setD] = useState(expiresAt);
  const days = d ? Math.round((new Date(d).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[120px_1fr_160px_auto]">
      <span className="text-[13px] font-semibold text-ink">{type}</span>
      <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="Number" className="h-9" />
      <Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="h-9" />
      <div className="flex items-center gap-2">
        {days != null && <span className={`text-[12px] font-medium ${days < 0 ? "text-danger" : days < 30 ? "text-warning" : "text-muted"}`}>{days < 0 ? "Expired" : `${days}d left`}</span>}
        <Button size="sm" variant="secondary" loading={pending} disabled={!d} onClick={() => act(() => upsertVehicleDocument(vehicleId, type, n, d), `${type} saved`)}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function MaintenanceForm({ vehicles, defaultVehicle }: { vehicles: { id: string; label: string }[]; defaultVehicle?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addMaintenanceAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}
      <Field label="Vehicle" name="vehicleId">
        <Select id="vehicleId" name="vehicleId" defaultValue={defaultVehicle}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Task" name="title" error={state.fieldErrors?.title}>
        <Input id="title" name="title" placeholder="e.g. 20,000 km service" />
      </Field>
      <Field label="Scheduled for" name="scheduledFor" error={state.fieldErrors?.scheduledFor}>
        <Input id="scheduledFor" name="scheduledFor" type="date" />
      </Field>
      <Field label="Estimated cost (₹)" name="cost">
        <Input id="cost" name="cost" type="number" min={0} />
      </Field>
      <Field label="Odometer (km)" name="odometer">
        <Input id="odometer" name="odometer" type="number" min={0} />
      </Field>
      <Field label="Details" name="description">
        <Input id="description" name="description" />
      </Field>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <Checkbox name="blockVehicle" label="Take the car off the road now" />
        <SubmitButton size="sm">Schedule</SubmitButton>
      </div>
    </form>
  );
}

export function MaintenanceStatus({ id, status }: { id: string; status: string }) {
  const { pending, act } = useAct();
  const next: Record<string, [string, "IN_PROGRESS" | "COMPLETED"][]> = {
    SCHEDULED: [["Start", "IN_PROGRESS"]],
    IN_PROGRESS: [["Complete", "COMPLETED"]],
  };
  return (
    <div className="flex gap-1">
      {(next[status] ?? []).map(([label, s]) => (
        <Button key={s} size="sm" variant="secondary" loading={pending} onClick={() => act(() => updateMaintenanceStatus(id, s), `Marked ${s.toLowerCase().replace("_", " ")}`)}>
          {label}
        </Button>
      ))}
      {(status === "SCHEDULED" || status === "IN_PROGRESS") && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateMaintenanceStatus(id, "CANCELLED"), "Cancelled")}>
          Cancel
        </Button>
      )}
    </div>
  );
}
