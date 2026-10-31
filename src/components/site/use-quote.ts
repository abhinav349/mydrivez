"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/pricing";

export type QuoteState = { loading: boolean; quote: Quote | null; available: boolean | null; error: string | null };

/** Debounced live quote from the server. Client never computes the amount it will be charged. */
export function useQuote(args: { vehicleId: string; start: string; end: string; doorstep?: boolean; couponCode?: string | null }) {
  const [state, setState] = useState<QuoteState>({ loading: true, quote: null, available: null, error: null });
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    if (!args.start || !args.end) return;
    const start = new Date(`${args.start}:00+05:30`);
    const end = new Date(`${args.end}:00+05:30`);
    if (!(end > start)) {
      setState({ loading: false, quote: null, available: null, error: "Return must be after pickup." });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleId: args.vehicleId, start, end, doorstep: Boolean(args.doorstep), couponCode: args.couponCode || null }),
        });
        const json = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) setState({ loading: false, quote: null, available: null, error: json.error ?? "Could not calculate price." });
        else setState({ loading: false, quote: json.quote, available: json.available, error: null });
      } catch {
        if (id === seq.current) setState({ loading: false, quote: null, available: null, error: "Network error. Please retry." });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [args.vehicleId, args.start, args.end, args.doorstep, args.couponCode]);

  return state;
}
