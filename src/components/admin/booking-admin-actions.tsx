"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  adminCancelBooking,
  adminConfirmBooking,
  adminPreviewReturn,
  adminRecordPickup,
  adminRecordReturn,
  adminRetryRefund,
  uploadInspectionPhoto,
} from "@/app/actions/admin-bookings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatINR } from "@/lib/utils";

export function ConfirmButton({ id }: { id: string }) {
  const router = useRouter();
  const [p, start] = useTransition();
  return (
    <Button
      variant="accent"
      loading={p}
      onClick={() =>
        start(async () => {
          const r = await adminConfirmBooking(id);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Booking confirmed — customer notified.");
          router.refresh();
        })
      }
    >
      <CheckCircle2 className="h-4 w-4" /> Approve & confirm
    </Button>
  );
}

export function AdminCancelButton({ id, paid }: { id: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [full, setFull] = useState(true);
  const [p, start] = useTransition();
  return (
    <>
      <Button variant="danger-ghost" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" /> {paid ? "Cancel / reject" : "Cancel"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancel booking" description="The customer will be notified by email.">
        <div className="space-y-4">
          <Field label="Reason (shared with customer)" name="reason">
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" placeholder="e.g. Vehicle unavailable due to unscheduled maintenance" />
          </Field>
          {paid && <Checkbox checked={full} onChange={(e) => setFull(e.target.checked)} label="Issue a full refund (ignore cancellation policy)" />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              loading={p}
              onClick={() =>
                start(async () => {
                  const r = await adminCancelBooking(id, reason, full);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.data.refund ? `Cancelled — ${formatINR(r.data.refund)} refund initiated.` : "Booking cancelled.");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Cancel booking
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function RetryRefund({ id }: { id: string }) {
  const router = useRouter();
  const [p, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={p}
      onClick={() =>
        start(async () => {
          const r = await adminRetryRefund(id);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`Refund ${r.data.status.toLowerCase()}`);
          router.refresh();
        })
      }
    >
      Process refund
    </Button>
  );
}

type Damage = { area: string; severity: "MINOR" | "MODERATE" | "MAJOR"; note: string };

export function HandoverForm({
  bookingId,
  type,
  customerName,
  pickup,
  deposit,
}: {
  bookingId: string;
  type: "PICKUP" | "RETURN";
  customerName: string;
  pickup?: { odometer: number; fuelLevel: number };
  deposit: number;
}) {
  const router = useRouter();
  const [odometer, setOdometer] = useState(pickup ? String(pickup.odometer) : "");
  const [fuel, setFuel] = useState(pickup?.fuelLevel ?? 100);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [damageCharges, setDamageCharges] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState("");
  const [preview, setPreview] = useState<{ lateMinutes: number; lateReturnCharges: number; extraKm: number; extraKmCharges: number; fuelCharges: number; total: number; driven: number } | null>(null);
  const [p, start] = useTransition();

  useEffect(() => {
    if (type !== "RETURN" || !odometer) return;
    const t = setTimeout(async () => {
      const r = await adminPreviewReturn({ bookingId, odometer: Number(odometer), fuelLevel: fuel, damageCharges: Number(damageCharges) || 0 });
      if (r.ok) setPreview(r.data);
    }, 300);
    return () => clearTimeout(t);
  }, [type, bookingId, odometer, fuel, damageCharges]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files).slice(0, 12 - photos.length)) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await uploadInspectionPhoto(fd);
      if (r.ok) setPhotos((x) => [...x, r.data.url]);
      else toast.error(r.error);
    }
    setUploading(false);
  };

  const submit = () =>
    start(async () => {
      const payload = {
        bookingId,
        odometer: Number(odometer),
        fuelLevel: fuel,
        notes,
        photoUrls: photos,
        damages: damages.filter((d) => d.area.trim()),
        customerConfirmed: confirmed,
        customerSignature: signature,
        damageCharges: Number(damageCharges) || 0,
      };
      const r = type === "PICKUP" ? await adminRecordPickup(payload) : await adminRecordReturn(payload);
      if (!r.ok) return void toast.error(r.error);
      toast.success(type === "PICKUP" ? "Pickup recorded — trip is now active." : "Return recorded — deposit refund processed.");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Odometer reading (km)" name="odometer" hint={pickup ? `At pickup: ${pickup.odometer.toLocaleString("en-IN")} km` : undefined}>
          <Input id="odometer" type="number" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
        </Field>
        <Field label={`Fuel / charge level: ${fuel}%`} name="fuel" hint={pickup ? `At pickup: ${pickup.fuelLevel}%` : undefined}>
          <input id="fuel" type="range" min={0} max={100} step={5} value={fuel} onChange={(e) => setFuel(Number(e.target.value))} className="mt-3 w-full accent-ink" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Condition photos</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((u) => (
            <div key={u} className="group relative h-20 w-28 overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Inspection" className="h-full w-full object-cover" />
              <button onClick={() => setPhotos((x) => x.filter((y) => y !== u))} className="absolute right-1 top-1 rounded bg-white/90 p-0.5 opacity-0 group-hover:opacity-100" aria-label="Remove photo">
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </button>
            </div>
          ))}
          <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-[11.5px] text-muted hover:border-ink/30">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            Add photos
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" className="sr-only" onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink">{type === "PICKUP" ? "Existing scratches / damage" : "New damage found"}</p>
          <Button size="sm" variant="ghost" onClick={() => setDamages((d) => [...d, { area: "", severity: "MINOR", note: "" }])}>
            <Plus className="h-4 w-4" /> Add damage
          </Button>
        </div>
        <div className="space-y-2">
          {damages.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_1.4fr_auto]">
              <Input placeholder="Area (e.g. Rear bumper)" value={d.area} onChange={(e) => setDamages((x) => x.map((y, j) => (j === i ? { ...y, area: e.target.value } : y)))} />
              <Select value={d.severity} onChange={(e) => setDamages((x) => x.map((y, j) => (j === i ? { ...y, severity: e.target.value as Damage["severity"] } : y)))}>
                <option value="MINOR">Minor</option>
                <option value="MODERATE">Moderate</option>
                <option value="MAJOR">Major</option>
              </Select>
              <Input placeholder="Note" value={d.note} onChange={(e) => setDamages((x) => x.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} />
              <button onClick={() => setDamages((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-danger" aria-label="Remove damage">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!damages.length && <p className="text-[12.5px] text-muted">No damage recorded.</p>}
        </div>
      </div>

      {type === "RETURN" && (
        <Field label="Damage repair charges (₹)" name="damageCharges" hint="Assessed repair cost for new damage, if any.">
          <Input id="damageCharges" type="number" min={0} value={damageCharges} onChange={(e) => setDamageCharges(e.target.value)} />
        </Field>
      )}

      <Field label="Notes" name="notes">
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[70px]" placeholder="Interior condition, accessories handed over, etc." />
      </Field>

      {type === "RETURN" && preview && (
        <div className="space-y-1.5 rounded-xl bg-paper p-4 text-[13.5px]">
          <p className="font-semibold text-ink">Calculated charges</p>
          <Row k={`Driven ${preview.driven} km · extra ${preview.extraKm} km`} v={preview.extraKmCharges} />
          <Row k={`Late by ${preview.lateMinutes} min`} v={preview.lateReturnCharges} />
          <Row k="Fuel shortfall" v={preview.fuelCharges} />
          <Row k="Damage" v={Number(damageCharges) || 0} />
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
            <span>Total deducted from deposit</span>
            <span>{formatINR(preview.total)}</span>
          </div>
          <div className="flex justify-between text-success">
            <span>Deposit refund</span>
            <span>{formatINR(Math.max(0, deposit - preview.total))}</span>
          </div>
          {preview.total > deposit && <p className="text-[12.5px] font-medium text-danger">Charges exceed the deposit by {formatINR(preview.total - deposit)} — collect separately.</p>}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-line p-4">
        <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label={`${customerName} has inspected the vehicle and agrees with the recorded condition.`} />
        <Input placeholder="Customer's full name as signature" value={signature} onChange={(e) => setSignature(e.target.value)} />
      </div>

      <Button size="lg" className="w-full" loading={p} disabled={!odometer || (type === "PICKUP" && !confirmed)} onClick={submit}>
        {type === "PICKUP" ? "Hand over keys & start trip" : "Complete return & settle deposit"}
      </Button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{k}</span>
      <span className="font-medium text-ink">{formatINR(v)}</span>
    </div>
  );
}
