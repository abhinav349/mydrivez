import { NextResponse } from "next/server";
import { quoteSchema } from "@/lib/validators";
import { BookingError, findConflicts, quoteVehicle, expireStaleHolds } from "@/lib/booking/service";
import { getCurrentUser, clientIp } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

/** POST /api/quote — server-authoritative price + live availability for a vehicle and window. */
export async function POST(req: Request) {
  if (!(await rateLimit(`quote:${await clientIp()}`, 120, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = quoteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { vehicleId, start, end, doorstep, couponCode } = parsed.data;
  if (end <= start) return NextResponse.json({ error: "Return time must be after pickup time." }, { status: 400 });
  if (end.getTime() - start.getTime() > 120 * 86_400_000) return NextResponse.json({ error: "Rentals can be at most 90 days." }, { status: 400 });

  try {
    const user = await getCurrentUser();
    const { quote, settings } = await quoteVehicle({ vehicleId, start, end, doorstep, couponCode, userId: user?.id ?? null });
    await expireStaleHolds(vehicleId);
    const conflicts = await findConflicts(vehicleId, start, end, settings);
    return NextResponse.json({ quote, available: conflicts.length === 0 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Could not calculate price." }, { status: 500 });
  }
}
