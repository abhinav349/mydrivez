"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { uploadDocumentAction } from "@/app/actions/customer";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionState } from "@/lib/validators";
import { cn } from "@/lib/utils";

export function DocumentUploader({ defaultType = "DRIVING_LICENSE", compact = false, onDone }: { defaultType?: string; compact?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(uploadDocumentAction, {});
  const [fileName, setFileName] = useState<string | null>(null);
  const [type, setType] = useState(defaultType);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      setFileName(null);
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormError message={state.error} />
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-3")}>
        <Field label="Document type" name="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="DRIVING_LICENSE">Driving licence</option>
            <option value="GOVERNMENT_ID">Government ID (Aadhaar / Passport / Voter ID)</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Document number" name="documentNumber" error={state.fieldErrors?.documentNumber}>
          <Input id="documentNumber" name="documentNumber" placeholder={type === "DRIVING_LICENSE" ? "KA0120190012345" : "Last 4 digits are enough"} className="uppercase" />
        </Field>
        <Field label="Expiry date (if any)" name="expiresAt">
          <Input id="expiresAt" name="expiresAt" type="date" />
        </Field>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-8 text-center transition-colors hover:border-ink/30">
        {fileName ? <FileUp className="h-6 w-6 text-ink" /> : <UploadCloud className="h-6 w-6 text-muted" />}
        <span className="text-[14px] font-semibold text-ink">{fileName ?? "Choose a file or drag it here"}</span>
        <span className="text-[12px] text-muted">JPG, PNG, WEBP or PDF · max 4 MB · stored privately</span>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > 4 * 1024 * 1024) {
              toast.error("File is larger than 4 MB.");
              e.target.value = "";
              setFileName(null);
              return;
            }
            setFileName(f?.name ?? null);
          }}
        />
      </label>
      <SubmitButton pendingText="Uploading…" className="w-full sm:w-auto">
        Upload document
      </SubmitButton>
    </form>
  );
}
