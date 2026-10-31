import { Star } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent" | "dark";

const toneClass: Record<Tone, string> = {
  neutral: "bg-ink/[.06] text-graphite",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-lime-100 text-lime-600",
  dark: "bg-ink text-lime",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none", toneClass[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge({ map, value, override }: { map: Record<string, { label: string; tone: Tone }>; value: string; override?: string | null }) {
  const s = map[value] ?? { label: value, tone: "neutral" as Tone };
  return (
    <Badge tone={override === "Upcoming" ? "info" : s.tone} dot>
      {override ?? s.label}
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <span title="Seeded demo record — not a real customer transaction" className="rounded-md border border-dashed border-warning/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
      Demo
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-ink/[.06]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-semibold text-lime", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-ink/10 text-transparent"} />
      ))}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lime">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-[21px] font-bold tracking-[-0.04em]", dark ? "text-white" : "text-ink", className)}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill={dark ? "#C6F36B" : "#101820"} />
        <path d="M8 21.5V11l8 7 8-7v10.5" fill="none" stroke={dark ? "#101820" : "#C6F36B"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        My<span className={dark ? "text-lime" : "text-ink/60"}>Drivez</span>
      </span>
    </span>
  );
}

export function SectionHeading({ eyebrow, title, body, align = "left", dark }: { eyebrow?: string; title: React.ReactNode; body?: string; align?: "left" | "center"; dark?: boolean }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className={cn("eyebrow mb-3", dark && "text-lime")}>{eyebrow}</p>}
      <h2 className={cn("text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[42px]", dark && "text-white")}>{title}</h2>
      {body && <p className={cn("mt-4 text-[15.5px] leading-relaxed", dark ? "text-white/60" : "text-muted")}>{body}</p>}
    </div>
  );
}

export function StatTile({ label, value, sub, icon: Icon, tone = "neutral" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ElementType; tone?: "neutral" | "accent" }) {
  return (
    <div className={cn("card p-5", tone === "accent" && "border-ink bg-ink text-white")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[12.5px] font-medium", tone === "accent" ? "text-white/60" : "text-muted")}>{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone === "accent" ? "bg-lime text-ink" : "bg-paper text-ink")}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn("mt-3 font-display text-[28px] font-semibold tracking-[-0.03em]", tone === "accent" ? "text-white" : "text-ink")}>{value}</p>
      {sub && <div className={cn("mt-1 text-[12.5px]", tone === "accent" ? "text-white/60" : "text-muted")}>{sub}</div>}
    </div>
  );
}
