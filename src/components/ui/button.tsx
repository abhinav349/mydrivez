import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-ink text-white hover:bg-ink-700 shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_8px_20px_-8px_rgba(16,24,32,.6)]",
  accent: "bg-lime text-ink hover:bg-lime-400 shadow-[0_8px_24px_-10px_rgba(147,199,46,.9)]",
  secondary: "bg-white text-ink border border-line hover:border-ink/25 hover:bg-paper",
  ghost: "text-ink hover:bg-ink/[.05]",
  danger: "bg-danger text-white hover:bg-red-700",
  "danger-ghost": "text-danger hover:bg-danger-soft",
  link: "text-ink underline-offset-4 hover:underline px-0 h-auto",
  "dark-ghost": "text-white/80 hover:text-white hover:bg-white/10",
  "dark-outline": "border border-white/20 text-white hover:bg-white/10",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-[52px] px-7 text-[15px] rounded-xl gap-2.5",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold tracking-[-0.01em] transition-all duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
