"use client";

import { useActionState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction, updateProfileAction, uploadAvatarAction } from "@/app/actions/customer";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Avatar } from "@/components/ui/misc";
import { INDIAN_STATES } from "@/lib/constants";
import type { ActionState } from "@/lib/validators";

function useToast(state: ActionState, reset?: () => void) {
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      reset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

type ProfileData = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseState: string;
  emergencyName: string;
  emergencyPhone: string;
};

export function ProfileForm({ data }: { data: ProfileData }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, {});
  useToast(state);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-8">
      <FormError message={state.error} />
      <Group title="Personal details">
        <Field label="Full name" name="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={data.name} />
        </Field>
        <Field label="Email" name="email" hint="Contact support to change your email.">
          <Input id="email" value={data.email} disabled />
        </Field>
        <Field label="Mobile number" name="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={data.phone} />
        </Field>
        <Field label="Date of birth" name="dateOfBirth">
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={data.dateOfBirth} />
        </Field>
      </Group>
      <Group title="Address">
        <Field label="Address line 1" name="addressLine1" className="sm:col-span-2">
          <Input id="addressLine1" name="addressLine1" defaultValue={data.addressLine1} />
        </Field>
        <Field label="Address line 2" name="addressLine2" className="sm:col-span-2">
          <Input id="addressLine2" name="addressLine2" defaultValue={data.addressLine2} />
        </Field>
        <Field label="City" name="city">
          <Input id="city" name="city" defaultValue={data.city} />
        </Field>
        <Field label="State" name="state">
          <Select id="state" name="state" defaultValue={data.state}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="PIN code" name="pincode" error={fe.pincode}>
          <Input id="pincode" name="pincode" inputMode="numeric" maxLength={6} defaultValue={data.pincode} />
        </Field>
      </Group>
      <Group title="Driving licence">
        <Field label="Licence number" name="licenseNumber">
          <Input id="licenseNumber" name="licenseNumber" className="uppercase" defaultValue={data.licenseNumber} />
        </Field>
        <Field label="Valid until" name="licenseExpiry">
          <Input id="licenseExpiry" name="licenseExpiry" type="date" defaultValue={data.licenseExpiry} />
        </Field>
        <Field label="Issuing state" name="licenseState">
          <Select id="licenseState" name="licenseState" defaultValue={data.licenseState}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </Group>
      <Group title="Emergency contact">
        <Field label="Name" name="emergencyName">
          <Input id="emergencyName" name="emergencyName" defaultValue={data.emergencyName} />
        </Field>
        <Field label="Phone" name="emergencyPhone">
          <Input id="emergencyPhone" name="emergencyPhone" defaultValue={data.emergencyPhone} />
        </Field>
      </Group>
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-4 text-[15px] font-semibold text-ink">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function AvatarForm({ name, src }: { name: string; src: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(uploadAvatarAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useToast(state);
  return (
    <form ref={formRef} action={action} className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={name} src={src} size={72} />
        <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-lime text-ink shadow-card" aria-label="Upload profile photo">
          <Camera className="h-4 w-4" />
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={() => formRef.current?.requestSubmit()} />
        </label>
      </div>
      <div>
        <p className="font-semibold text-ink">{name}</p>
        <p className="text-[12.5px] text-muted">JPG, PNG or WEBP · up to 4 MB</p>
        {state.error && <p className="text-[12.5px] font-medium text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(changePasswordAction, {});
  useToast(state, () => formRef.current?.reset());
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Current password" name="currentPassword" error={fe.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" name="password" error={fe.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" name="confirmPassword" error={fe.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
