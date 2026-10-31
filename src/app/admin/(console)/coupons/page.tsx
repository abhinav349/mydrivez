import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDate, formatINR } from "@/lib/utils";
import { PageHeader, Panel, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { CouponActions } from "@/components/admin/pricing-controls";
import { CouponEditor } from "@/components/admin/coupon-editor";

export const metadata: Metadata = { title: "Coupons" };

const d = (x: Date) => x.toISOString().slice(0, 10);

export default async function CouponsPage() {
  await requireStaffPage("pricing:write");
  const coupons = await db.coupon.findMany({ orderBy: [{ isActive: "desc" }, { validUntil: "desc" }], include: { _count: { select: { bookings: true } } } });
  const now = new Date();
  return (
    <div>
      <PageHeader
        title="Coupons & promotions"
        description="Percentage or fixed discounts with expiry, minimum amounts and usage limits. Validated on the server at checkout."
        actions={
          <CouponEditor
            mode="create"
            data={{ code: "", title: "", description: "", discountType: "PERCENT", value: 10, maxDiscount: "", minBookingAmount: 0, validFrom: d(now), validUntil: d(new Date(now.getTime() + 30 * 86_400_000)), usageLimit: "", perUserLimit: 1, firstBookingOnly: false, isPublic: true }}
          />
        }
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Discount</th>
                <th className={th}>Conditions</th>
                <th className={th}>Validity</th>
                <th className={`${th} text-right`}>Used</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => {
                const expired = c.validUntil < now;
                return (
                  <tr key={c.id}>
                    <td className={td}>
                      <p className="font-mono font-bold text-ink">{c.code}</p>
                      <p className="text-[12px] text-muted">{c.title}</p>
                    </td>
                    <td className={`${td} font-semibold`}>
                      {c.discountType === "PERCENT" ? `${c.value}%` : formatINR(c.value)}
                      {c.maxDiscount && <p className="text-[12px] font-normal text-muted">max {formatINR(c.maxDiscount)}</p>}
                    </td>
                    <td className={`${td} text-[12.5px] text-muted`}>
                      {c.minBookingAmount > 0 && <p>Min {formatINR(c.minBookingAmount)}</p>}
                      <p>{c.perUserLimit}× per customer</p>
                      {c.firstBookingOnly && <p>First booking only</p>}
                      {!c.isPublic && <p>Private code</p>}
                    </td>
                    <td className={`${td} text-[12.5px]`}>
                      {formatDate(c.validFrom)} → {formatDate(c.validUntil)}
                    </td>
                    <td className={`${td} text-right`}>
                      {c.usedCount}
                      {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                    </td>
                    <td className={td}>{expired ? <Badge tone="neutral">Expired</Badge> : c.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Paused</Badge>}</td>
                    <td className={td}>
                      <div className="flex justify-end gap-1">
                        <CouponEditor
                          mode="edit"
                          data={{
                            id: c.id,
                            code: c.code,
                            title: c.title,
                            description: c.description ?? "",
                            discountType: c.discountType,
                            value: c.value,
                            maxDiscount: c.maxDiscount?.toString() ?? "",
                            minBookingAmount: c.minBookingAmount,
                            validFrom: d(c.validFrom),
                            validUntil: d(c.validUntil),
                            usageLimit: c.usageLimit?.toString() ?? "",
                            perUserLimit: c.perUserLimit,
                            firstBookingOnly: c.firstBookingOnly,
                            isPublic: c.isPublic,
                          }}
                        />
                        <CouponActions id={c.id} active={c.isActive} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
