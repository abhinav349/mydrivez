import type { Metadata } from "next";
import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { DOC_STATUS } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/misc";
import { DocumentUploader } from "@/components/account/document-uploader";

export const metadata: Metadata = { title: "My documents" };

export default async function DocumentsPage() {
  const user = await requireCustomerPage();
  const docs = await db.customerDocument.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { file: { select: { id: true, name: true, mimeType: true } } } });
  const verified = (t: string) => docs.some((d) => d.type === t && d.status === "VERIFIED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">My documents</h1>
        <p className="mt-1 text-[14px] text-muted">Upload once, drive anywhere. Documents are encrypted at rest and only visible to our verification team.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["DRIVING_LICENSE", "Driving licence", "Valid Indian licence held for 1+ year"],
          ["GOVERNMENT_ID", "Government ID", "Aadhaar, passport or voter ID"],
        ].map(([t, label, hint]) => (
          <div key={t} className={`card flex items-center gap-4 p-5 ${verified(t!) ? "border-success/30" : ""}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${verified(t!) ? "bg-success-soft text-success" : "bg-paper text-ink"}`}>
              {verified(t!) ? <ShieldCheck className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-semibold text-ink">{label}</p>
              <p className="text-[12.5px] text-muted">{verified(t!) ? "Verified — you're good to go" : hint}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="mb-5 text-[16px] font-semibold">Upload a document</h2>
        <DocumentUploader />
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-6 py-4 text-[16px] font-semibold">Submitted documents</h2>
        {docs.length ? (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
                <FileText className="hidden h-5 w-5 text-muted sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{titleCase(d.type)}</p>
                  <p className="text-[12.5px] text-muted">
                    {d.documentNumber ?? "—"} · uploaded {formatDate(d.createdAt)}
                    {d.expiresAt && ` · expires ${formatDate(d.expiresAt)}`}
                  </p>
                  {d.status === "REJECTED" && d.rejectionReason && <p className="mt-1 text-[12.5px] font-medium text-danger">Reason: {d.rejectionReason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge map={DOC_STATUS} value={d.status} />
                  <a href={`/api/files/${d.file.id}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-ink underline underline-offset-4">
                    View
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-[14px] text-muted">No documents yet.</p>
        )}
      </section>
    </div>
  );
}
