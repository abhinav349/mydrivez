import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { relativeTime } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Avatar, Badge } from "@/components/ui/misc";
import { CreateStaffForm, PermissionEditor } from "@/components/admin/staff-controls";

export const metadata: Metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const me = await requireStaffPage();
  if (me.role !== "ADMIN") redirect("/admin?denied=1");
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { adminProfile: true } });
  return (
    <div className="space-y-6">
      <PageHeader title="Staff & roles" description="Administrators have full access. Staff accounts only see and do what their permissions allow — enforced on the server." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title={`Team (${staff.length})`}>
          <ul className="divide-y divide-line">
            {staff.map((s) => (
              <li key={s.id} className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} src={s.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {s.name}
                      <Badge tone={s.role === "ADMIN" ? "dark" : "info"}>{s.role === "ADMIN" ? "Admin" : "Staff"}</Badge>
                      {s.status === "SUSPENDED" && <Badge tone="danger">Deactivated</Badge>}
                      {s.id === me.id && <Badge>You</Badge>}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {s.adminProfile?.title ?? "—"} · {s.email} · last login {s.lastLoginAt ? relativeTime(s.lastLoginAt) : "never"}
                    </p>
                  </div>
                </div>
                {s.role === "STAFF" && <PermissionEditor userId={s.id} current={s.adminProfile?.permissions ?? []} status={s.status} self={s.id === me.id} />}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Add team member">
          <div className="p-5">
            <CreateStaffForm />
          </div>
        </Panel>
      </div>
    </div>
  );
}
