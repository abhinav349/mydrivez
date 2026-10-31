import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  await requireStaffPage("fleet:write");
  const locs = await db.vehicleLocation.findMany({ where: { isActive: true }, include: { city: true }, orderBy: { name: "asc" } });
  return (
    <div>
      <Link href="/admin/fleet" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Fleet
      </Link>
      <div className="mt-3">
        <PageHeader title="Add a new car" description="It goes live on the website as soon as it's saved with status Available." />
      </div>
      <VehicleForm
        locations={locs.map((l) => ({ id: l.id, label: `${l.name}, ${l.city.name}` }))}
        data={{
          brand: "", model: "", variant: "", registrationNumber: "", year: new Date().getFullYear(), category: "SUV", fuelType: "PETROL", transmission: "AUTOMATIC",
          seats: 5, engine: "", mileage: "", color: "", description: "", features: "", hourlyRate: 0, dailyRate: 0, weeklyRate: 0, monthlyRate: 0,
          securityDeposit: 5000, includedKmPerDay: 250, extraKmCharge: 12, fuelPolicy: "Same-to-same: return with the fuel level you received.", locationId: "", status: "AVAILABLE", isFeatured: false,
        }}
      />
    </div>
  );
}
