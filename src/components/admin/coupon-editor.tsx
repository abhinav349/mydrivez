"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { CouponForm, type CouponData } from "./pricing-controls";

export function CouponEditor({ data, mode }: { data: CouponData; mode: "create" | "edit" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {mode === "create" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      ) : (
        <Button size="icon-sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Edit coupon">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Create coupon" : `Edit ${data.code}`} className="sm:max-w-2xl">
        <CouponForm data={data} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
