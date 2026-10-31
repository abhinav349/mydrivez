import type { Metadata } from "next";
import { Download, Gauge, IndianRupee, Percent, Receipt, UserPlus } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { getAnalytics, parseRange, RANGES } from "@/lib/queries/admin";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatCompactINR, formatINR } from "@/lib/utils";
import { BookingTrendChart, GrowthChart, HBarChart, RevenueChart } from "@/components/admin/charts";
import { Kpi, PageHeader, Panel, Segmented } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaffPage("dashboard:view");
  const range = parseRange(sp.range);
  const includeDemo = sp.data !== "live";
  const a = await getAnalytics(range, includeDemo);
  const params = { range, data: sp.data };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Performance over the last ${RANGES[range].label}${includeDemo ? " (including demo data)" : " (live data only)"}.`}
        actions={
          <>
            <Segmented basePath="/admin/analytics" param="data" value={includeDemo ? "all" : "live"} params={params} options={[{ value: "all", label: "Incl. demo" }, { value: "live", label: "Live only" }]} />
            <Segmented basePath="/admin/analytics" param="range" value={range} params={params} options={Object.entries(RANGES).map(([k, v]) => ({ value: k, label: v.label }))} />
            <a href={`/api/admin/export/bookings?from=${a.from.toISOString()}&data=${includeDemo ? "all" : "live"}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink hover:border-ink/25">
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Kpi label="Revenue" value={formatCompactINR(a.revenue)} delta={a.revenueDelta} icon={IndianRupee} />
        <Kpi label="Avg. booking value" value={formatINR(a.avgBookingValue)} icon={Receipt} />
        <Kpi label="Fleet utilisation" value={`${a.fleetUtil}%`} sub="hours rented / available" icon={Gauge} />
        <Kpi label="Cancellation rate" value={`${a.cancellationRate}%`} sub={`${a.cancelled} cancelled`} icon={Percent} />
        <Kpi label="New customers" value={a.newCustomers} icon={UserPlus} />
      </div>

      <Panel title={`Revenue · ${a.granularity === "day" ? "daily" : a.granularity === "week" ? "weekly" : "monthly"}`}>
        <div className="p-4 pt-5">
          <RevenueChart data={a.timeline} height={320} />
        </div>
        <details className="border-t border-line px-5 py-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-muted">View as table</summary>
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1.5">Period</th>
                  <th className="py-1.5 text-right">Revenue</th>
                  <th className="py-1.5 text-right">Paid bookings</th>
                  <th className="py-1.5 text-right">Cancelled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.timeline.map((t) => (
                  <tr key={t.key}>
                    <td className="py-1.5">{t.label}</td>
                    <td className="py-1.5 text-right">{formatINR(t.revenue)}</td>
                    <td className="py-1.5 text-right">{t.completed}</td>
                    <td className="py-1.5 text-right">{t.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Booking trends">
          <div className="p-4 pt-5">
            <BookingTrendChart data={a.timeline} />
          </div>
        </Panel>
        <Panel title="Customer growth">
          <div className="p-4 pt-5">
            <GrowthChart data={a.growth} height={280} />
          </div>
        </Panel>
        <Panel title="Most rented cars" action={<span className="text-[12px] text-muted">paid trips</span>}>
          <div className="p-4">
            {a.mostRented.length ? <HBarChart data={a.mostRented} dataKey="trips" name="Trips" /> : <Empty />}
          </div>
        </Panel>
        <Panel title="Most profitable vehicles" action={<span className="text-[12px] text-muted">revenue</span>}>
          <div className="p-4">
            {a.mostProfitable.length ? <HBarChart data={a.mostProfitable} dataKey="revenue" name="Revenue" money /> : <Empty />}
          </div>
        </Panel>
        <Panel title="Vehicle utilisation" action={<span className="text-[12px] text-muted">% of hours rented</span>}>
          <div className="p-4">
            <HBarChart data={a.utilization.slice(0, 10)} dataKey="pct" name="Utilisation" suffix="%" />
          </div>
        </Panel>
        <Panel title="Revenue by category">
          <div className="p-4">
            {a.byCategory.length ? (
              <HBarChart data={a.byCategory.map((c) => ({ name: CATEGORY_LABEL[c.category as "SUV"], revenue: c.revenue }))} dataKey="revenue" name="Revenue" money />
            ) : (
              <Empty />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-10 text-center text-[13.5px] text-muted">No data in this period.</p>;
}
