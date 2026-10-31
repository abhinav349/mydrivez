import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-muted/70 transition-colors focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-lime/40 disabled:cursor-not-allowed disabled:bg-paper aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(base, "h-11", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[110px] py-3 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-11 appearance-none pr-10", className)} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)}>
      {children}
    </label>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  name?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label htmlFor={name}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-[13.5px] text-graphite", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-ink" {...p} />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger">
      {message}
    </div>
  );
}
