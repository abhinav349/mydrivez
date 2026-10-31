"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-[14.5px] text-muted">We hit a bump. Please try again — if it keeps happening, contact support{error.digest ? ` with code ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
