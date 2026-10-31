import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { DOC_STATUS } from "@/lib/constants";
import { formatDate, relativeTime, titleCase } from "@/lib/utils";
import { PageHeader, Panel, Segmented } from "@/components/admin/ui";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui/misc";
import { DocumentDecision } from "@/components/admin/review-controls";

export const metadata: Metadata = { title: "Document verification" };

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  await requireStaffPage("customers:write");
  const status = (["PENDING", "VERIFIED", "REJECTED"].includes(sp.status ?? "") ? sp.status : "PENDING") as "PENDING";
  const docs = await db.customerDocument.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 60,
    include: { user: { include: { customerProfile: true } }, file: { select: { id: true, mimeType: true } }, reviewedBy: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Document verification"
        description="Verify licences and IDs before handover. Oldest submissions first."
        actions={<Segmented basePath="/admin/verifications" param="status" value={status} params={{}} options={[{ value: "PENDING", label: "Pending" }, { value: "VERIFIED", label: "Verified" }, { value: "REJECTED", label: "Rejected" }]} />}
      />
      {docs.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {docs.map((d) => (
            <Panel key={d.id}>
              <div className="flex flex-col gap-4 p-5 sm:flex-row">
                <a href={`/api/files/${d.file.id}`} target="_blank" rel="noopener noreferrer" className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper sm:w-44">
                  {d.file.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${d.file.id}`} alt="Document preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[12px] font-semibold text-muted">
                      <FileCheck2 className="h-6 w-6" /> Open PDF
                    </span>
                  )}
                </a>
                <div className="min-w-0 flex-1 space-y-2 text-[13.5px]">
                  <div className="flex items-center gap-2">
                    <Avatar name={d.user.name} src={d.user.avatarUrl} size={28} />
                    <Link href={`/admin/customers/${d.userId}`} className="font-semibold text-ink hover:underline">
                      {d.user.name}
                    </Link>
                  </div>
                  <p>
                    <span className="font-medium text-ink">{titleCase(d.type)}</span> · <span className="font-mono">{d.documentNumber ?? "—"}</span>
                  </p>
                  <p className="text-[12.5px] text-muted">
                    Submitted {relativeTime(d.createdAt)}
                    {d.expiresAt && ` · expires ${formatDate(d.expiresAt)}`}
                    {d.user.customerProfile?.licenseNumber && d.type === "DRIVING_LICENSE" && ` · profile DL ${d.user.customerProfile.licenseNumber}`}
                  </p>
                  {d.reviewedBy && (
                    <p className="text-[12.5px] text-muted">
                      Reviewed by {d.reviewedBy.name}
                      {d.rejectionReason && ` — ${d.rejectionReason}`}
                    </p>
                  )}
                  <div className="pt-1">{d.status === "PENDING" ? <DocumentDecision id={d.id} /> : <StatusBadge map={DOC_STATUS} value={d.status} />}</div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileCheck2} title="Queue is clear" body="No documents waiting in this list." />
      )}
    </div>
  );
}
