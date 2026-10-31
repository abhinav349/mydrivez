import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * GET /api/files/:id — streams a stored file.
 * Public media is cacheable; private documents require the owner or staff with customers:write.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file || (!file.data && !file.url)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!file.isPublic) {
    const user = await getCurrentUser();
    const allowed = user && (user.id === file.ownerId || hasPermission(user.role, user.permissions, "customers:write"));
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!file.data && file.url) return NextResponse.redirect(file.url);

  return new NextResponse(Buffer.from(file.data!), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      // Only sniffed JPEG/PNG/WEBP/PDF are ever stored. Chrome's PDF viewer refuses to run under a sandbox CSP.
      ...(file.mimeType === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
      "Cache-Control": file.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
