/** Public base URL: APP_URL if set, otherwise Vercel's production/preview domain, otherwise localhost. Edge-safe. */
export function siteUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod && process.env.VERCEL_ENV === "production") return `https://${prod}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
