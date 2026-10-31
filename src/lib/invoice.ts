import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Booking, BookingPricing, Payment, Refund, User, Vehicle, VehicleLocation } from "@prisma/client";
import { BRAND, BOOKING_STATUS, PAYMENT_STATUS } from "./constants";
import type { LineItem } from "./pricing";

type FullBooking = Booking & {
  user: User;
  vehicle: Vehicle;
  pickupLocation: VehicleLocation;
  pricing: BookingPricing | null;
  payments: Payment[];
  refunds: Refund[];
};

const INK = rgb(0.063, 0.094, 0.125);
const MUTED = rgb(0.45, 0.48, 0.53);
const LINE = rgb(0.9, 0.91, 0.93);
const LIME = rgb(0.776, 0.953, 0.42);

// Standard PDF fonts are WinAnsi-encoded and cannot render "₹", so amounts print as "INR".
const money = (n: number) => `INR ${Math.round(n).toLocaleString("en-IN")}`;
const date = (d: Date) =>
  d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, "");

export async function renderBookingPdf(b: FullBooking, kind: "invoice" | "confirmation") {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${BRAND.name} ${kind === "invoice" ? "Invoice" : "Booking confirmation"} ${b.code}`);
  pdf.setAuthor(BRAND.name);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const M = 48;

  const text = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = INK) =>
    p.drawText(ascii(s), { x, y, size, font: f, color });
  const right = (p: PDFPage, s: string, xRight: number, y: number, size = 10, f: PDFFont = font, color = INK) =>
    text(p, s, xRight - f.widthOfTextAtSize(ascii(s), size), y, size, f, color);

  // Header band
  page.drawRectangle({ x: 0, y: 762, width: W, height: 80, color: INK });
  text(page, "My", M, 795, 24, bold, rgb(1, 1, 1));
  text(page, "Drivez", M + bold.widthOfTextAtSize("My", 24), 795, 24, bold, LIME);
  right(page, kind === "invoice" ? "TAX INVOICE" : "BOOKING CONFIRMATION", W - M, 806, 11, bold, rgb(1, 1, 1));
  right(page, b.code, W - M, 788, 10, font, LIME);

  let y = 730;
  text(page, BRAND.name + " Mobility Pvt. Ltd.", M, y, 10, bold);
  text(page, BRAND.address, M, y - 14, 8.5, font, MUTED);
  text(page, `GSTIN ${BRAND.gstin}  |  ${BRAND.supportEmail}  |  ${BRAND.phone}`, M, y - 26, 8.5, font, MUTED);
  right(page, `Issued ${date(new Date())}`, W - M, y, 9, font, MUTED);
  right(page, `Status: ${BOOKING_STATUS[b.status].label}`, W - M, y - 14, 9, bold);
  if (b.isDemo) right(page, "DEMO RECORD - NOT A REAL TRANSACTION", W - M, y - 28, 8, bold, rgb(0.8, 0.2, 0.2));

  // Billed to / Vehicle
  y = 664;
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: W - M, y: y + 14 }, color: LINE, thickness: 1 });
  text(page, "BILLED TO", M, y, 8, bold, MUTED);
  text(page, b.user.name, M, y - 16, 11, bold);
  text(page, b.user.email, M, y - 30, 9, font, MUTED);
  text(page, b.user.phone ?? "", M, y - 42, 9, font, MUTED);

  const cx = 310;
  text(page, "VEHICLE", cx, y, 8, bold, MUTED);
  text(page, `${b.vehicle.brand} ${b.vehicle.model} ${b.vehicle.variant ?? ""}`.trim(), cx, y - 16, 11, bold);
  text(page, `${b.vehicle.registrationNumber}  |  ${b.vehicle.year}  |  ${b.vehicle.transmission === "AUTOMATIC" ? "Automatic" : "Manual"}`, cx, y - 30, 9, font, MUTED);
  text(page, `Pickup: ${b.pickupLocation.name}`, cx, y - 42, 9, font, MUTED);

  // Trip
  y = 590;
  page.drawRectangle({ x: M, y: y - 46, width: W - 2 * M, height: 58, color: rgb(0.969, 0.973, 0.98) });
  text(page, "PICKUP", M + 16, y - 6, 8, bold, MUTED);
  text(page, date(b.startAt), M + 16, y - 24, 11, bold);
  text(page, "RETURN", M + 196, y - 6, 8, bold, MUTED);
  text(page, date(b.endAt), M + 196, y - 24, 11, bold);
  const p = b.pricing!;
  text(page, "DURATION", M + 376, y - 6, 8, bold, MUTED);
  text(page, `${p.billedDays}d ${p.billedHours}h  |  ${p.includedKm} km incl.`, M + 376, y - 24, 11, bold);

  // Line items
  y = 510;
  text(page, "DESCRIPTION", M, y, 8, bold, MUTED);
  right(page, "AMOUNT", W - M, y, 8, bold, MUTED);
  page.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, color: LINE, thickness: 1 });
  y -= 26;
  const items = (p.lineItems as unknown as LineItem[]).filter((i) => i.kind !== "deposit" && i.kind !== "tax");
  const post: [string, number][] = [
    ["Extra kilometre charges", p.extraKmCharges],
    ["Late return charges", p.lateReturnCharges],
    ["Fuel charges", p.fuelCharges],
    ["Damage charges", p.damageCharges],
  ];
  for (const it of items) {
    text(page, it.label, M, y, 10);
    right(page, (it.amount < 0 ? "- " : "") + money(Math.abs(it.amount)), W - M, y, 10, font, it.amount < 0 ? rgb(0.1, 0.55, 0.3) : INK);
    y -= 20;
  }
  const taxable = p.baseAmount + p.surgeAmount + p.deliveryFee - p.discountAmount;
  page.drawLine({ start: { x: 330, y: y + 6 }, end: { x: W - M, y: y + 6 }, color: LINE, thickness: 1 });
  y -= 10;
  const sumRow = (label: string, val: string, strong = false) => {
    text(page, label, 330, y, strong ? 11 : 10, strong ? bold : font, strong ? INK : MUTED);
    right(page, val, W - M, y, strong ? 11 : 10, strong ? bold : font);
    y -= 18;
  };
  sumRow("Taxable value", money(taxable));
  sumRow(`CGST (${p.taxRate / 2}%)`, money(p.taxAmount / 2));
  sumRow(`SGST (${p.taxRate / 2}%)`, money(p.taxAmount - p.taxAmount / 2));
  sumRow("Rental total", money(p.rentalTotal), true);
  sumRow("Refundable security deposit", money(p.securityDeposit));
  for (const [label, amt] of post) if (amt > 0) sumRow(label, money(amt));
  y -= 4;
  page.drawRectangle({ x: 320, y: y - 10, width: W - M - 320, height: 30, color: INK });
  text(page, "Amount paid at booking", 332, y, 10, bold, rgb(1, 1, 1));
  right(page, money(p.totalPayable), W - M - 12, y, 11, bold, LIME);
  y -= 50;

  // Payments
  text(page, "PAYMENTS", M, y, 8, bold, MUTED);
  y -= 16;
  const pays = b.payments.filter((x) => x.status !== "CREATED");
  if (!pays.length) {
    text(page, "No payments recorded yet.", M, y, 9, font, MUTED);
    y -= 16;
  }
  for (const pay of pays) {
    text(page, `${pay.provider}${pay.isTest ? " (test)" : ""}  |  ${pay.providerPaymentId ?? pay.id}`, M, y, 9);
    text(page, PAYMENT_STATUS[pay.status].label, 360, y, 9, bold);
    right(page, money(pay.amount), W - M, y, 9);
    y -= 15;
  }
  for (const r of b.refunds) {
    text(page, `Refund (${r.type.toLowerCase()})  |  ${r.providerRefundId ?? "pending"}`, M, y, 9, font, MUTED);
    text(page, r.status, 360, y, 9, bold, MUTED);
    right(page, "- " + money(r.amount), W - M, y, 9, font, MUTED);
    y -= 15;
  }

  // Footer
  page.drawLine({ start: { x: M, y: 92 }, end: { x: W - M, y: 92 }, color: LINE, thickness: 1 });
  const terms =
    kind === "invoice"
      ? "SAC 996601 - Rental services of road vehicles without operator. This is a computer generated invoice and does not require a signature."
      : "Carry your original driving licence and the ID you uploaded. Fuel policy: same-to-same. Late returns are charged per hour after a 30-minute grace period.";
  text(page, terms.slice(0, 110), M, 76, 8, font, MUTED);
  text(page, terms.slice(110), M, 64, 8, font, MUTED);
  text(page, `Thank you for driving with ${BRAND.name}.`, M, 44, 9, bold);

  return pdf.save();
}
