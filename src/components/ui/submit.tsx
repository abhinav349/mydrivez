"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} loading={pending} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
