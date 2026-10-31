"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStaffAction, setStaffStatus, updateStaffPermissions } from "@/app/actions/admin-misc";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { ActionState } from "@/lib/validators";

export function CreateStaffForm() {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(createStaffAction, {});
  const [role, setRole] = useState("STAFF");
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" error={fe.name}>
          <Input id="name" name="name" />
        </Field>
        <Field label="Work email" name="email" error={fe.email}>
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Job title" name="title">
          <Input id="title" name="title" placeholder="Hub manager, Koramangala" />
        </Field>
        <Field label="Role" name="role">
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="STAFF">Staff (limited permissions)</option>
            <option value="ADMIN">Administrator (full access)</option>
          </Select>
        </Field>
        <Field label="Temporary password" name="password" error={fe.password} hint="Share securely; ask them to change it." className="sm:col-span-2">
          <Input id="password" name="password" type="text" autoComplete="off" />
        </Field>
      </div>
      {role === "STAFF" && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink">Permissions</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(PERMISSIONS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] text-graphite">
                <input type="checkbox" name="permissions" value={k} defaultChecked={k === "dashboard:view"} className="h-4 w-4 accent-ink" />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <SubmitButton>Add team member</SubmitButton>
    </form>
  );
}

export function PermissionEditor({ userId, current, status, self }: { userId: string; current: string[]; status: string; self: boolean }) {
  const router = useRouter();
  const [perms, setPerms] = useState(current);
  const [pending, start] = useTransition();
  const dirty = perms.slice().sort().join() !== current.slice().sort().join();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(PERMISSIONS).map(([k, v]) => {
          const on = perms.includes(k);
          return (
            <button
              key={k}
              title={v}
              onClick={() => setPerms((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${on ? "border-ink bg-ink text-lime" : "border-line bg-white text-muted"}`}
            >
              {k}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await updateStaffPermissions(userId, perms);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Permissions updated");
              router.refresh();
            })
          }
        >
          Save permissions
        </Button>
        {!self && (
          <Button
            size="sm"
            variant={status === "ACTIVE" ? "danger-ghost" : "secondary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setStaffStatus(userId, status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
                if (!r.ok) return void toast.error(r.error);
                router.refresh();
              })
            }
          >
            {status === "ACTIVE" ? "Deactivate" : "Reactivate"}
          </Button>
        )}
      </div>
    </div>
  );
}
