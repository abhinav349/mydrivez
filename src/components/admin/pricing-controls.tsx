"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPricingRuleAction, deleteCoupon, deletePricingRule, saveCouponAction, toggleCoupon, togglePricingRule } from "@/app/actions/admin-misc";
import { updateVehicleRates } from "@/app/actions/admin-fleet";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { ActionState } from "@/lib/validators";

type Res = { ok: true } | { ok: false; error: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    act: (fn: () => Promise<Res>, msg: string) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) return void toast.error(r.error);
        toast.success(msg);
        router.refresh();
      }),
  };
}

function useFormToast(state: ActionState, onOk?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onOk?.();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PricingRuleForm() {
  const [state, action] = useActionState<ActionState, FormData>(createPricingRuleAction, {});
  const [type, setType] = useState("WEEKEND");
  useFormToast(state);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <FormError message={state.error} />
      <Field label="Rule name" name="name" error={fe.name} className="sm:col-span-2">
        <Input id="name" name="name" placeholder="e.g. Long weekend surge" />
      </Field>
      <Field label="Type" name="type">
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="WEEKEND">Weekend / day of week</option>
          <option value="SEASONAL">Seasonal (date range)</option>
          <option value="HOLIDAY">Special holiday (date range)</option>
        </Select>
      </Field>
      <Field label="Adjustment (%)" name="adjustmentPct" error={fe.adjustmentPct} hint="Use negative numbers for discounts">
        <Input id="adjustmentPct" name="adjustmentPct" type="number" min={-50} max={200} defaultValue={15} />
      </Field>
      {type === "WEEKEND" ? (
        <Field label="Days" name="daysOfWeek" error={fe.daysOfWeek} className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                <input type="checkbox" name="daysOfWeek" value={i} defaultChecked={i === 0 || i === 6} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
        </Field>
      ) : (
        <>
          <Field label="From" name="startDate" error={fe.startDate}>
            <Input id="startDate" name="startDate" type="date" />
          </Field>
          <Field label="To" name="endDate" error={fe.endDate}>
            <Input id="endDate" name="endDate" type="date" />
          </Field>
        </>
      )}
      <Field label="Applies to" name="category">
        <Select id="category" name="category" defaultValue="">
          <option value="">Entire fleet</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v} only
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end">
        <SubmitButton>Create rule</SubmitButton>
      </div>
    </form>
  );
}

export function RuleActions({ id, active }: { id: string; active: boolean }) {
  const { pending, act } = useAct();
  return (
    <div className="flex gap-1">
      <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => act(() => togglePricingRule(id), active ? "Rule paused" : "Rule activated")} aria-label={active ? "Pause rule" : "Activate rule"}>
        {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button size="icon-sm" variant="danger-ghost" disabled={pending} onClick={() => act(() => deletePricingRule(id), "Rule deleted")} aria-label="Delete rule">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

type Rates = { hourlyRate: number; dailyRate: number; weeklyRate: number; monthlyRate: number; securityDeposit: number; extraKmCharge: number };

export function RateRow({ id, name, reg, rates }: { id: string; name: string; reg: string; rates: Rates }) {
  const { pending, act } = useAct();
  const [r, setR] = useState(rates);
  const dirty = (Object.keys(rates) as (keyof Rates)[]).some((k) => r[k] !== rates[k]);
  const cell = (k: keyof Rates) => (
    <td className="px-2 py-2">
      <input
        type="number"
        min={0}
        value={r[k]}
        onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })}
        className="h-9 w-24 rounded-lg border border-line bg-paper px-2 text-right text-[13px] font-medium outline-none focus:border-ink/30 focus:bg-white"
        aria-label={`${name} ${k}`}
      />
    </td>
  );
  return (
    <tr className={dirty ? "bg-lime-50/60" : ""}>
      <td className="px-4 py-2">
        <p className="font-medium text-ink">{name}</p>
        <p className="font-mono text-[11px] text-muted">{reg}</p>
      </td>
      {cell("hourlyRate")}
      {cell("dailyRate")}
      {cell("weeklyRate")}
      {cell("monthlyRate")}
      {cell("securityDeposit")}
      {cell("extraKmCharge")}
      <td className="px-4 py-2 text-right">
        <Button size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={pending} onClick={() => act(() => updateVehicleRates(id, r), `${name} pricing updated`)}>
          Save
        </Button>
      </td>
    </tr>
  );
}

export type CouponData = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discountType: string;
  value: number;
  maxDiscount: string;
  minBookingAmount: number;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
  perUserLimit: number;
  firstBookingOnly: boolean;
  isPublic: boolean;
};

export function CouponForm({ data, onDone }: { data: CouponData; onDone?: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCouponAction, {});
  useFormToast(state, onDone);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {data.id && <input type="hidden" name="id" value={data.id} />}
      <FormError message={state.error} />
      <Field label="Code" name="code" error={fe.code}>
        <Input id="code" name="code" defaultValue={data.code} className="uppercase" placeholder="SUMMER20" />
      </Field>
      <Field label="Title" name="title" error={fe.title}>
        <Input id="title" name="title" defaultValue={data.title} placeholder="Summer road-trip deal" />
      </Field>
      <Field label="Description" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={data.description} className="min-h-[70px]" />
      </Field>
      <Field label="Discount type" name="discountType">
        <Select id="discountType" name="discountType" defaultValue={data.discountType}>
          <option value="PERCENT">Percentage (%)</option>
          <option value="FIXED">Fixed amount (₹)</option>
        </Select>
      </Field>
      <Field label="Value" name="value" error={fe.value}>
        <Input id="value" name="value" type="number" min={1} defaultValue={data.value} />
      </Field>
      <Field label="Max discount (₹, optional)" name="maxDiscount">
        <Input id="maxDiscount" name="maxDiscount" type="number" min={0} defaultValue={data.maxDiscount} />
      </Field>
      <Field label="Minimum booking amount (₹)" name="minBookingAmount">
        <Input id="minBookingAmount" name="minBookingAmount" type="number" min={0} defaultValue={data.minBookingAmount} />
      </Field>
      <Field label="Valid from" name="validFrom" error={fe.validFrom}>
        <Input id="validFrom" name="validFrom" type="date" defaultValue={data.validFrom} />
      </Field>
      <Field label="Expires" name="validUntil" error={fe.validUntil}>
        <Input id="validUntil" name="validUntil" type="date" defaultValue={data.validUntil} />
      </Field>
      <Field label="Total usage limit (optional)" name="usageLimit">
        <Input id="usageLimit" name="usageLimit" type="number" min={1} defaultValue={data.usageLimit} />
      </Field>
      <Field label="Uses per customer" name="perUserLimit">
        <Input id="perUserLimit" name="perUserLimit" type="number" min={1} defaultValue={data.perUserLimit} />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Checkbox name="firstBookingOnly" defaultChecked={data.firstBookingOnly} label="First booking only" />
        <Checkbox name="isPublic" defaultChecked={data.isPublic} label="Show publicly on the website & offers page" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{data.id ? "Save coupon" : "Create coupon"}</SubmitButton>
      </div>
    </form>
  );
}

export function CouponActions({ id, active }: { id: string; active: boolean }) {
  const { pending, act } = useAct();
  return (
    <div className="flex gap-1">
      <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => act(() => toggleCoupon(id), active ? "Coupon paused" : "Coupon activated")} aria-label={active ? "Pause" : "Activate"}>
        {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button size="icon-sm" variant="danger-ghost" disabled={pending} onClick={() => act(() => deleteCoupon(id), "Coupon removed")} aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
