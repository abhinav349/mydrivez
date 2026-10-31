import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Link-based segmented control that preserves other query params. */
export function Segmented({ options, value, param, params, basePath }: { options: { value: string; label: string }[]; value: string; param: string; params: Record<string, string | undefined>; basePath: string }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1">
      {options.map((o) => {
        const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]);
        q.set(param, o.value);
        q.delete("page");
        return (
          <Link
            key={o.value}
            href={`${basePath}?${q}`}
            className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors", o.value === value ? "bg-ink text-white" : "text-muted hover:text-ink")}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pageSize, total, params, basePath }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]);
    q.set("page", String(p));
    return `${basePath}?${q}`;
  };
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
      <span>
        {total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "No results"}
      </span>
      <div className="flex items-center gap-1">
        <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={cn("rounded-lg border border-line bg-white p-1.5", page <= 1 && "pointer-events-none opacity-40")} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="px-2 font-medium text-ink">
          {page} / {pages}
        </span>
        <Link aria-disabled={page >= pages} href={href(Math.min(pages, page + 1))} className={cn("rounded-lg border border-line bg-white p-1.5", page >= pages && "pointer-events-none opacity-40")} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function SortHeader({ label, field, sort, dir, params, basePath, className }: { label: string; field: string; sort: string; dir: string; params: Record<string, string | undefined>; basePath: string; className?: string }) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]);
  const active = sort === field;
  q.set("sort", field);
  q.set("dir", active && dir === "desc" ? "asc" : "desc");
  return (
    <th className={cn("px-4 py-3 font-semibold", className)}>
      <Link href={`${basePath}?${q}`} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label} {active && (dir === "desc" ? "↓" : "↑")}
      </Link>
    </th>
  );
}

export const th = "px-4 py-3 text-left font-semibold";
export const td = "px-4 py-3.5";
export const tableWrap = "overflow-x-auto";
export const tableCls = "w-full min-w-[760px] text-[13.5px]";
export const theadCls = "border-b border-line bg-paper/60 text-[11.5px] uppercase tracking-wider text-muted";

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, delta, sub, icon: Icon, href }: { label: string; value: React.ReactNode; delta?: number | null; sub?: string; icon: React.ElementType; href?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-white p-5 transition-all hover:border-ink/15 hover:shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-ink">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        {delta != null && <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", delta >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
