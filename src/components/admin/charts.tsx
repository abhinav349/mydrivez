"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatCompactINR, formatINR } from "@/lib/utils";

// Chart tokens. Single-series marks use ink; lime only ever as an area fill (too low-contrast for thin lines).
// Two-series charts use validated categorical slots 1–2 (blue / orange, all checks pass on light surface).
const C = {
  ink: "#101820",
  lime: "#C6F36B",
  s1: "#2a78d6",
  s2: "#eb6834",
  grid: "#EEF0F3",
  axis: "#8A919C",
};

const axisProps = { tick: { fill: C.axis, fontSize: 11.5 }, tickLine: false, axisLine: false } as const;

function TooltipCard({ active, payload, label, money }: TooltipProps<number, string> & { money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-lift">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-graphite">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color === C.lime ? C.ink : p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-4 font-semibold text-ink">{money ? formatINR(Number(p.value)) : Number(p.value).toLocaleString("en-IN")}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data, height = 280 }: { data: { label: string; revenue: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Revenue over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.lime} stopOpacity={0.75} />
              <stop offset="100%" stopColor={C.lime} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} tickFormatter={(v) => formatCompactINR(v)} width={64} />
          <Tooltip content={<TooltipCard money />} cursor={{ stroke: C.ink, strokeWidth: 1, strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.ink} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: C.ink }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BookingTrendChart({ data, height = 280 }: { data: { label: string; completed: number; cancelled: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Bookings over time">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={<TooltipCard />} cursor={{ fill: "rgba(16,24,32,.04)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: C.axis, paddingTop: 8 }} />
          <Bar dataKey="completed" name="Paid bookings" stackId="a" fill={C.s1} stroke="#fff" strokeWidth={1} animationDuration={800} />
          <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={C.s2} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({
  data,
  dataKey,
  name,
  money,
  suffix,
  height,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  name: string;
  money?: boolean;
  suffix?: string;
  height?: number;
}) {
  const h = height ?? Math.max(160, data.length * 40);
  return (
    <div style={{ height: h }} role="img" aria-label={name}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" {...axisProps} width={150} tick={{ fill: "#20242A", fontSize: 12 }} />
          <Tooltip content={<TooltipCard money={money} />} cursor={{ fill: "rgba(16,24,32,.04)" }} />
          <Bar
            dataKey={dataKey}
            name={name}
            fill={C.ink}
            radius={[0, 4, 4, 0]}
            animationDuration={800}
            label={{ position: "right", fill: "#20242A", fontSize: 11.5, formatter: (v: number) => (money ? formatCompactINR(v) : `${v}${suffix ?? ""}`) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrowthChart({ data, height = 240 }: { data: { label: string; customers: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Customer growth">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} allowDecimals={false} domain={["dataMin - 2", "auto"]} />
          <Tooltip content={<TooltipCard />} cursor={{ stroke: C.ink, strokeWidth: 1, strokeDasharray: "3 3" }} />
          <Line type="monotone" dataKey="customers" name="Total customers" stroke={C.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} animationDuration={900} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
