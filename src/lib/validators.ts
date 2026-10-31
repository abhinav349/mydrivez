import { z } from "zod";

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(\+91)?[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number")
  .transform((v) => (v.startsWith("+91") ? v : `+91${v}`));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone,
    password: passwordSchema,
    confirmPassword: z.string(),
    referralCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal("")),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or mobile number"),
  password: z.string().min(1, "Enter your password"),
  remember: z.string().optional(),
});

export const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  dateOfBirth: z.string().optional().or(z.literal("")),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "Enter a 6-digit PIN code").optional(),
  licenseNumber: z.string().trim().toUpperCase().max(20).optional(),
  licenseExpiry: z.string().optional().or(z.literal("")),
  licenseState: z.string().trim().max(60).optional(),
  emergencyName: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(15).optional(),
});

export const bookingSchema = z.object({
  vehicleId: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  pickupLocationId: z.string().min(1, "Choose a pickup location"),
  dropoffLocationId: z.string().optional().nullable(),
  doorstep: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  couponCode: z.string().trim().toUpperCase().max(30).optional().nullable(),
  customerNote: z.string().trim().max(500).optional().nullable(),
});

export const quoteSchema = z.object({
  vehicleId: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  doorstep: z.boolean().default(false),
  couponCode: z.string().trim().toUpperCase().max(30).optional().nullable(),
});

const money = z.coerce.number().int().min(0).max(10_000_000);

export const vehicleSchema = z.object({
  brand: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(60),
  variant: z.string().trim().max(60).optional(),
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(v), "Use a valid registration number, e.g. KA01AB1234"),
  year: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1),
  category: z.enum(["HATCHBACK", "SEDAN", "SUV", "LUXURY", "ELECTRIC", "PREMIUM"]),
  fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
  seats: z.coerce.number().int().min(2).max(12),
  engine: z.string().trim().max(80).optional(),
  mileage: z.string().trim().max(40).optional(),
  color: z.string().trim().max(30).optional(),
  description: z.string().trim().min(20, "Write at least 20 characters").max(2000),
  features: z.string().max(1000).optional(),
  hourlyRate: money.refine((v) => v > 0, "Required"),
  dailyRate: money.refine((v) => v > 0, "Required"),
  weeklyRate: money.refine((v) => v > 0, "Required"),
  monthlyRate: money.refine((v) => v > 0, "Required"),
  securityDeposit: money,
  includedKmPerDay: z.coerce.number().int().min(0).max(2000),
  extraKmCharge: money,
  fuelPolicy: z.string().trim().max(300).optional(),
  locationId: z.string().min(1, "Choose a pickup hub"),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "INACTIVE"]),
  isFeatured: z.string().optional(),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or numbers"),
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(300).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(1),
  maxDiscount: z.coerce.number().int().min(0).optional().or(z.literal("")),
  minBookingAmount: z.coerce.number().int().min(0).default(0),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(1).optional().or(z.literal("")),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  firstBookingOnly: z.string().optional(),
  isPublic: z.string().optional(),
});

export const ticketSchema = z.object({
  subject: z.string().trim().min(5, "Add a short subject").max(120),
  category: z.enum(["BOOKING", "PAYMENT", "VEHICLE", "ACCOUNT", "DOCUMENTS", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  bookingId: z.string().optional(),
  message: z.string().trim().min(10, "Tell us a bit more").max(3000),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
});

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = issue.path.join(".") || "_form";
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string; data?: Record<string, unknown> };
