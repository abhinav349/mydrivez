import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { PageHeader, Panel, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { MaintenanceForm, MaintenanceStatus } from "@/components/admin/fleet-controls";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  await requireStaffPage("fleet:write");
  const soon = new Date(Date.now() + 30 * 86_400_000);
  const [records, vehicles, expiring] = await Promise.all([
    db.maintenanceRecord.findMany({ orderBy: [{ status: "asc" }, { scheduledFor: "asc" }], take: 100, include: { vehicle: true } }),
    db.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { brand: "asc" }, select: { id: true, brand: true, model: true, registrationNumber: true } }),
    db.vehicleDocument.findMany({ where: { expiresAt: { lt: soon } }, orderBy: { expiresAt: "asc" }, include: { vehicle: true } }),
  ]);
  const tone = { SCHEDULED: "info", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Service schedules, workshop jobs and compliance renewals." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Schedule maintenance">
          <div className="p-5">
            <MaintenanceForm vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.registrationNumber}` }))} defaultVehicle={vehicle} />
          </div>
        </Panel>
        <Panel title={`Documents expiring within 30 days (${expiring.length})`}>
          <ul className="divide-y divide-line text-[13px]">
            {expiring.map((d) => {
              const days = Math.round((d.expiresAt.getTime() - Date.now()) / 86_400_000);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/admin/fleet/${d.vehicleId}`} className="hover:underline">
                    <span className="font-medium text-ink">{d.type}</span> · {d.vehicle.brand} {d.vehicle.model} <span className="font-mono text-muted">{d.vehicle.registrationNumber}</span>
                  </Link>
                  <Badge tone={days < 0 ? "danger" : days < 10 ? "warning" : "info"}>{days < 0 ? "Expired" : `${days} days`}</Badge>
                </li>
              );
            })}
            {!expiring.length && <li className="px-5 py-8 text-center text-muted">All documents are current.</li>}
          </ul>
        </Panel>
      </div>
      <Panel title="Maintenance log">
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Vehicle</th>
                <th className={th}>Task</th>
                <th className={th}>Scheduled</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.map((m) => (
                <tr key={m.id}>
                  <td className={td}>
                    <Link href={`/admin/fleet/${m.vehicleId}`} className="font-medium text-ink hover:underline">
                      {m.vehicle.brand} {m.vehicle.model}
                    </Link>
                    <p className="font-mono text-[11.5px] text-muted">{m.vehicle.registrationNumber}</p>
                  </td>
                  <td className={td}>
                    {m.title}
                    {m.description && <p className="text-[12px] text-muted">{m.description}</p>}
                  </td>
                  <td className={td}>{formatDate(m.scheduledFor)}</td>
                  <td className={td}>
                    <Badge tone={tone[m.status]}>{titleCase(m.status)}</Badge>
                  </td>
                  <td className={`${td} text-right`}>{m.cost ? formatINR(m.cost) : "—"}</td>
                  <td className={td}>
                    <MaintenanceStatus id={m.id} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
