import type {
  BookingStatus,
  DocumentStatus,
  FuelType,
  PaymentStatus,
  TicketPriority,
  TicketStatus,
  Transmission,
  VehicleCategory,
  VehicleStatus,
} from "@prisma/client";

export const BRAND = {
  name: "MyDrivez",
  short: "MDZ",
  tagline: "Your Journey. Your Rules. Your Drive.",
  email: "hello@mydrivez.in",
  supportEmail: "support@mydrivez.in",
  phone: "+91 80 4567 8900",
  address: "4th Floor, Prestige Atrium, Residency Road, Bengaluru 560025",
  gstin: "29ABCDE1234F1Z5",
};

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  HATCHBACK: "Hatchback",
  SEDAN: "Sedan",
  SUV: "SUV",
  LUXURY: "Luxury",
  ELECTRIC: "Electric",
  PREMIUM: "Premium",
};

export const CATEGORY_BLURB: Record<VehicleCategory, string> = {
  HATCHBACK: "Nimble city runabouts",
  SEDAN: "Refined highway cruisers",
  SUV: "Space for every plan",
  LUXURY: "Arrive in the extraordinary",
  ELECTRIC: "Silent, zero-emission drives",
  PREMIUM: "Elevated everyday comfort",
};

export const CATEGORY_IMAGE: Record<VehicleCategory, string> = {
  HATCHBACK: "/photos/cat-hatchback.jpg",
  SEDAN: "/photos/cat-sedan.jpg",
  SUV: "/photos/cat-suv.jpg",
  LUXURY: "/photos/cat-luxury.jpg",
  ELECTRIC: "/photos/cat-ev.jpg",
  PREMIUM: "/photos/cat-premium.jpg",
};

export const FUEL_LABEL: Record<FuelType, string> = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  ELECTRIC: "Electric",
  HYBRID: "Hybrid",
  CNG: "CNG",
};

export const TRANSMISSION_LABEL: Record<Transmission, string> = {
  MANUAL: "Manual",
  AUTOMATIC: "Automatic",
};

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "warning" },
  PAYMENT_COMPLETED: { label: "Payment completed", tone: "info" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  ACTIVE: { label: "Active", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  BOOKED: { label: "Booked", tone: "info" },
  RENTED: { label: "Currently rented", tone: "accent" },
  MAINTENANCE: { label: "Under maintenance", tone: "warning" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  CREATED: { label: "Initiated", tone: "neutral" },
  AUTHORIZED: { label: "Authorized", tone: "info" },
  CAPTURED: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "info" },
};

export const DOC_STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "accent" },
  AWAITING_CUSTOMER: { label: "Awaiting you", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

/** Booking statuses that hold the vehicle's calendar (mirrors the DB exclusion constraint). */
export const BLOCKING_STATUSES: BookingStatus[] = ["PENDING", "AWAITING_PAYMENT", "PAYMENT_COMPLETED", "CONFIRMED", "ACTIVE"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
