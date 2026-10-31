"use client";

import { useActionState, useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { saveVehicleAction } from "@/app/actions/admin-fleet";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { CATEGORY_LABEL, FUEL_LABEL } from "@/lib/constants";
import type { ActionState } from "@/lib/validators";

export type VehicleFormData = {
  id?: string;
  brand: string;
  model: string;
  variant: string;
  registrationNumber: string;
  year: number;
  category: string;
  fuelType: string;
  transmission: string;
  seats: number;
  engine: string;
  mileage: string;
  color: string;
  description: string;
  features: string;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  securityDeposit: number;
  includedKmPerDay: number;
  extraKmCharge: number;
  fuelPolicy: string;
  locationId: string;
  status: string;
  isFeatured: boolean;
};

export function VehicleForm({ data, locations }: { data: VehicleFormData; locations: { id: string; label: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveVehicleAction, {});
  const [daily, setDaily] = useState(data.dailyRate || 0);
  const [files, setFiles] = useState<string[]>([]);
  const fe = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok) toast.success(state.message);
  }, [state]);

  const num = (name: keyof VehicleFormData, label: string, hint?: string, onChange?: (v: number) => void) => (
    <Field label={label} name={name} error={fe[name]} hint={hint}>
      <Input id={name} name={name} type="number" min={0} defaultValue={String(data[name] ?? "")} onChange={onChange ? (e) => onChange(Number(e.target.value)) : undefined} aria-invalid={!!fe[name]} />
    </Field>
  );

  return (
    <form action={action} className="space-y-8" encType="multipart/form-data">
      {data.id && <input type="hidden" name="id" value={data.id} />}
      <FormError message={state.error} />

      <Section title="Vehicle" desc="Identity and specifications.">
        <Field label="Brand" name="brand" error={fe.brand}>
          <Input id="brand" name="brand" defaultValue={data.brand} placeholder="Hyundai" />
        </Field>
        <Field label="Model" name="model" error={fe.model}>
          <Input id="model" name="model" defaultValue={data.model} placeholder="Creta" />
        </Field>
        <Field label="Variant" name="variant">
          <Input id="variant" name="variant" defaultValue={data.variant} placeholder="SX(O) Diesel AT" />
        </Field>
        <Field label="Registration number" name="registrationNumber" error={fe.registrationNumber}>
          <Input id="registrationNumber" name="registrationNumber" defaultValue={data.registrationNumber} placeholder="KA01AB1234" className="uppercase" />
        </Field>
        <Field label="Manufacturing year" name="year" error={fe.year}>
          <Input id="year" name="year" type="number" defaultValue={data.year} />
        </Field>
        <Field label="Category" name="category">
          <Select id="category" name="category" defaultValue={data.category}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fuel type" name="fuelType">
          <Select id="fuelType" name="fuelType" defaultValue={data.fuelType}>
            {Object.entries(FUEL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transmission" name="transmission">
          <Select id="transmission" name="transmission" defaultValue={data.transmission}>
            <option value="AUTOMATIC">Automatic</option>
            <option value="MANUAL">Manual</option>
          </Select>
        </Field>
        <Field label="Seating capacity" name="seats" error={fe.seats}>
          <Input id="seats" name="seats" type="number" min={2} max={12} defaultValue={data.seats} />
        </Field>
        <Field label="Engine" name="engine">
          <Input id="engine" name="engine" defaultValue={data.engine} placeholder="1.5L CRDi, 116 PS" />
        </Field>
        <Field label="Mileage / range" name="mileage">
          <Input id="mileage" name="mileage" defaultValue={data.mileage} placeholder="19.1 km/l" />
        </Field>
        <Field label="Colour" name="color">
          <Input id="color" name="color" defaultValue={data.color} />
        </Field>
        <Field label="Description" name="description" error={fe.description} className="sm:col-span-2 lg:col-span-3">
          <Textarea id="description" name="description" defaultValue={data.description} placeholder="What makes this car great for a trip?" />
        </Field>
        <Field label="Features" name="features" hint="One per line or comma-separated" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="features" name="features" defaultValue={data.features} className="min-h-[90px]" placeholder={"Apple CarPlay\nSunroof\n360° camera"} />
        </Field>
      </Section>

      <Section title="Pricing" desc="All prices in INR, before GST. Weekly/monthly are applied automatically for long rentals.">
        {num("hourlyRate", "Hourly rate")}
        {num("dailyRate", "Daily rate", undefined, setDaily)}
        {num("weeklyRate", "Weekly rate", daily ? `Suggested ≈ ${Math.round(daily * 6)} (1 day free)` : undefined)}
        {num("monthlyRate", "Monthly rate", daily ? `Suggested ≈ ${Math.round(daily * 21)}` : undefined)}
        {num("securityDeposit", "Security deposit")}
        {num("includedKmPerDay", "Included km / day")}
        {num("extraKmCharge", "Extra km charge (₹/km)")}
        <Field label="Fuel policy" name="fuelPolicy" className="sm:col-span-2">
          <Input id="fuelPolicy" name="fuelPolicy" defaultValue={data.fuelPolicy} />
        </Field>
      </Section>

      <Section title="Availability" desc="Where it lives and whether it's bookable.">
        <Field label="Pickup hub" name="locationId" error={fe.locationId}>
          <Select id="locationId" name="locationId" defaultValue={data.locationId}>
            <option value="">Select hub</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" name="status">
          <Select id="status" name="status" defaultValue={["AVAILABLE", "MAINTENANCE", "INACTIVE"].includes(data.status) ? data.status : "AVAILABLE"}>
            <option value="AVAILABLE">Available</option>
            <option value="MAINTENANCE">Under maintenance</option>
            <option value="INACTIVE">Inactive (hidden)</option>
          </Select>
        </Field>
        <div className="flex items-end pb-3">
          <Checkbox name="isFeatured" defaultChecked={data.isFeatured} label="Feature on homepage" />
        </div>
      </Section>

      <Section title="Photos" desc="JPG/PNG/WEBP. Keep each save under 4 MB in total (hosting limit) — add more photos in batches. Reorder on the car page.">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-8 text-center hover:border-ink/30 sm:col-span-2 lg:col-span-3">
          <ImagePlus className="h-6 w-6 text-muted" />
          <span className="text-[14px] font-semibold text-ink">{files.length ? `${files.length} photo(s) selected` : "Choose photos"}</span>
          <span className="text-[12px] text-muted">{files.join(", ")}</span>
          <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
        </label>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-line bg-white/90 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <SubmitButton size="lg" pendingText="Saving…">
          {data.id ? "Save changes" : "Add vehicle"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <p className="mb-5 text-[13px] text-muted">{desc}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
