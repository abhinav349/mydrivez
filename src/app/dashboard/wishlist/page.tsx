import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { getCardsByIds, searchVehicles } from "@/lib/queries/vehicles";
import { CarCard } from "@/components/site/car-card";
import { EmptyState } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { RecentlyViewed } from "@/components/account/recently-viewed";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireCustomerPage();
  const rows = await db.wishlist.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { vehicleId: true } });
  const [cars, all] = await Promise.all([getCardsByIds(rows.map((r) => r.vehicleId)), searchVehicles({})]);
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Wishlist</h1>
        <p className="mb-6 mt-1 text-[14px] text-muted">Cars you&apos;ve saved for later.</p>
        {cars.length ? (
          <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
            {cars.map((c) => (
              <CarCard key={c.id} car={c} saved />
            ))}
          </div>
        ) : (
          <EmptyState icon={Heart} title="Your wishlist is empty" body="Tap the heart on any car to save it here." action={<LinkButton href="/cars">Explore cars</LinkButton>} />
        )}
      </section>
      <section>
        <h2 className="mb-5 text-lg font-semibold">Recently viewed</h2>
        <RecentlyViewed all={all} />
      </section>
    </div>
  );
}
