"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addLocationAction, saveSettingsAction, toggleLocation } from "@/app/actions/admin-misc";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { AppSettings } from "@/lib/settings";
import type { ActionState } from "@/lib/validators";

const FIELDS: [keyof AppSettings, string, string][] = [
  ["taxRatePct", "GST rate (%)", "Applied to the taxable rental value"],
  ["doorstepFee", "Doorstep delivery fee (₹)", "Flat fee for delivery + collection"],
  ["lateFeeMultiplier", "Late fee multiplier", "× hourly rate per late hour"],
  ["lateGraceMinutes", "Late grace period (min)", "No late fee within this window"],
  ["fuelChargePerPct", "Fuel shortfall charge (₹ per %)", "Charged per % below pickup level"],
  ["minHours", "Minimum rental (hours)", ""],
  ["maxRentalDays", "Maximum rental (days)", ""],
  ["minLeadMinutes", "Minimum booking lead time (min)", "How soon before pickup a booking can be made"],
  ["turnaroundMinutes", "Turnaround buffer (min)", "Blocked time between bookings for cleaning"],
  ["holdMinutes", "Payment hold (min)", "How long a car is reserved during checkout"],
  ["loyaltyPointsPer100", "Loyalty points per ₹100", ""],
  ["referralBonusPoints", "Referral bonus (points)", ""],
];

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(saveSettingsAction, {});
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} name={k} hint={hint || undefined}>
            <Input id={k} name={k} type="number" step="any" defaultValue={String(settings[k])} />
          </Field>
        ))}
      </div>
      <div className="space-y-2 rounded-xl bg-paper p-4">
        <Checkbox name="manualApproval" defaultChecked={settings.manualApproval} label="Manual approval — paid bookings wait for staff confirmation" />
        <Checkbox name="requireVerifiedDocs" defaultChecked={settings.requireVerifiedDocs} label="Require verified documents — bookings stay in review until licence & ID are verified" />
      </div>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

export function LocationForm() {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(addLocationAction, {});
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <FormError message={state.error} />
      <Field label="City" name="city" error={fe.city}>
        <Input id="city" name="city" placeholder="Chennai" />
      </Field>
      <Field label="State" name="state" error={fe.state}>
        <Input id="state" name="state" placeholder="Tamil Nadu" />
      </Field>
      <Field label="Hub name" name="name" error={fe.name}>
        <Input id="name" name="name" placeholder="T. Nagar Hub" />
      </Field>
      <Field label="Address" name="address" error={fe.address}>
        <Input id="address" name="address" />
      </Field>
      <Field label="Latitude" name="latitude" hint="For Google Maps directions">
        <Input id="latitude" name="latitude" type="number" step="any" />
      </Field>
      <Field label="Longitude" name="longitude">
        <Input id="longitude" name="longitude" type="number" step="any" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Add hub</SubmitButton>
      </div>
    </form>
  );
}

export function LocationToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [p, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={active ? "ghost" : "secondary"}
      loading={p}
      onClick={() =>
        start(async () => {
          const r = await toggleLocation(id);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        })
      }
    >
      {active ? "Disable" : "Enable"}
    </Button>
  );
}
