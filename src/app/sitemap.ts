import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { db } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const cars = await db.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, select: { slug: true, updatedAt: true } }).catch(() => []);
  const staticPages = ["", "/cars", "/how-it-works", "/about", "/contact", "/offers", "/legal/terms", "/legal/privacy", "/legal/cancellation", "/legal/rental-agreement"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...cars.map((c) => ({ url: `${base}/cars/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
