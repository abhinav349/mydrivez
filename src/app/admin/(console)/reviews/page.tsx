import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDate, titleCase } from "@/lib/utils";
import { PageHeader, Panel, Segmented } from "@/components/admin/ui";
import { Badge, DemoBadge, EmptyState, Stars } from "@/components/ui/misc";
import { ReviewDecision } from "@/components/admin/review-controls";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  await requireStaffPage("reviews:moderate");
  const status = (["PENDING", "APPROVED", "REJECTED"].includes(sp.status ?? "") ? sp.status : "PENDING") as "PENDING";
  const [reviews, counts] = await Promise.all([
    db.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } }, vehicle: { select: { id: true, brand: true, model: true } }, booking: { select: { id: true, code: true } } } }),
    db.review.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Only customers with a completed trip can review. Approved reviews update the car's public rating."
        actions={
          <Segmented
            basePath="/admin/reviews"
            param="status"
            value={status}
            params={{}}
            options={[
              { value: "PENDING", label: `Pending (${c.PENDING ?? 0})` },
              { value: "APPROVED", label: `Published (${c.APPROVED ?? 0})` },
              { value: "REJECTED", label: `Hidden (${c.REJECTED ?? 0})` },
            ]}
          />
        }
      />
      {reviews.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((r) => (
            <Panel key={r.id}>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Stars value={r.rating} size={15} />
                    <p className="mt-1 text-[13px] text-muted">
                      <span className="font-semibold text-ink">{r.user.name}</span> on{" "}
                      <Link href={`/admin/fleet/${r.vehicle.id}`} className="underline">
                        {r.vehicle.brand} {r.vehicle.model}
                      </Link>{" "}
                      · {formatDate(r.createdAt)} ·{" "}
                      <Link href={`/admin/bookings/${r.booking.id}`} className="font-mono">
                        {r.booking.code}
                      </Link>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.isDemo && <DemoBadge />}
                    <Badge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"}>{titleCase(r.status)}</Badge>
                  </div>
                </div>
                {r.title && <p className="font-semibold text-ink">{r.title}</p>}
                <p className="text-[14px] leading-relaxed text-graphite">{r.comment}</p>
                <ReviewDecision id={r.id} status={r.status} />
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState icon={Star} title="Nothing to moderate" />
      )}
    </div>
  );
}
