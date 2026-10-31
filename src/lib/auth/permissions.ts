export const PERMISSIONS = {
  "dashboard:view": "View dashboard & analytics",
  "fleet:write": "Add, edit and retire vehicles",
  "bookings:write": "Confirm, cancel and update bookings",
  "handover:write": "Record pickups and returns",
  "customers:write": "Verify documents, suspend customers",
  "pricing:write": "Manage pricing rules and coupons",
  "reviews:moderate": "Moderate reviews",
  "support:write": "Answer support tickets",
  "reports:export": "Export reports",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function hasPermission(role: string, granted: string[] | undefined, perm: Permission) {
  if (role === "ADMIN") return true;
  if (role !== "STAFF") return false;
  return (granted ?? []).includes(perm);
}
