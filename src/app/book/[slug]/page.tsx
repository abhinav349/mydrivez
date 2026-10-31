import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { getLocations, getVehicleBySlug } from "@/lib/queries/vehicles";
import { getSettings } from "@/lib/settings";
import { paymentMode } from "@/lib/payments/service";
import { Checkout } from "@/components/booking/checkout";

export const metadata: Metadata = { title: "Book your car", robots: { index: false } };

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await requireCustomerPage(`/book/${slug}`);
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [locations, settings, docs, profile, coupons] = await Promise.all([
    getLocations(),
    getSettings(),
    db.customerDocument.findMany({ where: { userId: user.id }, select: { type: true, status: true } }),
    db.customerProfile.findUnique({ where: { userId: user.id } }),
    db.coupon.findMany({ where: { isActive: true, isPublic: true, validUntil: { gt: new Date() }, validFrom: { lte: new Date() } }, orderBy: { value: "desc" } }),
  ]);
  const cityHubs = locations.filter((l) => l.city.slug === vehicle.location.city.slug);
  const docStatus = (t: "DRIVING_LICENSE" | "GOVERNMENT_ID") =>
    docs.find((d) => d.type === t && d.status === "VERIFIED") ? "VERIFIED" : docs.find((d) => d.type === t && d.status === "PENDING") ? "PENDING" : docs.find((d) => d.type === t) ? "REJECTED" : "MISSING";
  const pm = paymentMode();
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : undefined);

  return (
    <Checkout
      vehicle={{
        id: vehicle.id,
        slug: vehicle.slug,
        title: `${vehicle.brand} ${vehicle.model}`,
        variant: vehicle.variant,
        image: vehicle.images[0]?.url ?? null,
        category: vehicle.category,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        seats: vehicle.seats,
        hubId: vehicle.locationId,
        rating: vehicle.ratingAvg,
        ratingCount: vehicle.ratingCount,
      }}
      hubs={cityHubs.map((h) => ({ id: h.id, name: h.name, address: h.address }))}
      initial={{ start: valid(sp.start), end: valid(sp.end), drop: sp.drop }}
      user={{
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        emailVerified: user.emailVerified,
        address: [profile?.addressLine1, profile?.city, profile?.pincode].filter(Boolean).join(", "),
        licenseNumber: profile?.licenseNumber ?? null,
      }}
      docs={{ license: docStatus("DRIVING_LICENSE"), id: docStatus("GOVERNMENT_ID") }}
      requireVerifiedDocs={settings.requireVerifiedDocs}
      doorstepFee={settings.doorstepFee}
      holdMinutes={settings.holdMinutes}
      coupons={coupons.map((c) => ({ code: c.code, title: c.title, description: c.description ?? "" }))}
      payment={{ mode: pm.mode, test: pm.test }}
    />
  );
}
