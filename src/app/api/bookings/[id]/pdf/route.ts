import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { renderBookingPdf } from "@/lib/invoice";

/** GET /api/bookings/:id/pdf?type=invoice|confirmation — owner or staff only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await db.booking.findUnique({
    where: { id },
    include: { user: true, vehicle: true, pickupLocation: true, pricing: true, payments: { orderBy: { createdAt: "asc" } }, refunds: true },
  });
  if (!b || (user.role === "CUSTOMER" && b.userId !== user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!b.payments.some((p) => ["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)))
    return NextResponse.json({ error: "Documents are available once payment is complete." }, { status: 409 });

  const type = new URL(req.url).searchParams.get("type") === "confirmation" ? "confirmation" : "invoice";
  const bytes = await renderBookingPdf(b, type);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="MyDrivez-${type}-${b.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
