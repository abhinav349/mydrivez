import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { PricingRuleForm, RateRow, RuleActions } from "@/components/admin/pricing-controls";

export const metadata: Metadata = { title: "Pricing" };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PricingPage() {
  await requireStaffPage("pricing:write");
  const [rules, vehicles] = await Promise.all([
    db.pricingRule.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    db.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: [{ category: "asc" }, { dailyRate: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" description="Changes apply to every new quote on the website instantly. Existing bookings keep the price they were booked at." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title="New pricing rule">
          <div className="p-5">
            <PricingRuleForm />
          </div>
        </Panel>
        <Panel title="Active & scheduled rules">
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {r.name}
                    <Badge tone={r.adjustmentPct >= 0 ? "warning" : "success"}>
                      {r.adjustmentPct > 0 ? "+" : ""}
                      {r.adjustmentPct}%
                    </Badge>
                    {!r.isActive && <Badge>Paused</Badge>}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {titleCase(r.type)} · {r.daysOfWeek.length ? r.daysOfWeek.map((d) => DAY[d]).join(", ") : `${r.startDate ? formatDate(r.startDate) : ""} → ${r.endDate ? formatDate(r.endDate) : ""}`} ·{" "}
                    {r.category ? CATEGORY_LABEL[r.category] : "All cars"}
                  </p>
                </div>
                <RuleActions id={r.id} active={r.isActive} />
              </li>
            ))}
            {!rules.length && <li className="px-5 py-8 text-center text-[13.5px] text-muted">No rules yet.</li>}
          </ul>
        </Panel>
      </div>
      <Panel title="Base rates by vehicle">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="border-b border-line bg-paper/60 text-[11.5px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                {["Hourly", "Daily", "Weekly", "Monthly", "Deposit", "Extra/km"].map((h) => (
                  <th key={h} className="px-2 py-3 text-left font-semibold">
                    {h} ₹
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vehicles.map((v) => (
                <RateRow
                  key={v.id}
                  id={v.id}
                  name={`${v.brand} ${v.model}`}
                  reg={v.registrationNumber}
                  rates={{ hourlyRate: v.hourlyRate, dailyRate: v.dailyRate, weeklyRate: v.weeklyRate, monthlyRate: v.monthlyRate, securityDeposit: v.securityDeposit, extraKmCharge: v.extraKmCharge }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
