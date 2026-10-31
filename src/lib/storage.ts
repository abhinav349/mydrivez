import "server-only";
import { createHash } from "node:crypto";
import type { FileKind } from "@prisma/client";
import { db } from "./db";
import { env, cloudinaryEnabled } from "./env";

/**
 * Storage abstraction.
 * - Public media (vehicle photos, avatars, review & inspection photos) → Cloudinary when configured,
 *   otherwise the database driver served through /api/files/[id].
 * - Customer identity documents are ALWAYS private: stored by the DB driver and only streamed
 *   to their owner or authorised staff. Swap in a private bucket (e.g. Supabase Storage) here.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit

const SIGNATURES: { mime: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: "image/webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  { mime: "application/pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
];

export class UploadError extends Error {}

/** Validate by magic bytes, not by the client-declared MIME type or extension. */
export function sniffMime(bytes: Uint8Array, allowPdf: boolean) {
  const match = SIGNATURES.find((s) => s.test(bytes));
  if (!match) throw new UploadError("Unsupported file. Upload a JPG, PNG or WEBP image" + (allowPdf ? " or a PDF." : "."));
  if (match.mime === "application/pdf" && !allowPdf) throw new UploadError("PDFs aren't allowed here.");
  return match.mime;
}

export async function storeFile(file: File, opts: { ownerId: string; kind: FileKind }) {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("Please choose a file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("File is too large. Maximum size is 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isDocument = opts.kind === "DOCUMENT";
  const mime = sniffMime(bytes, isDocument);
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";

  if (!isDocument && cloudinaryEnabled && mime !== "application/pdf") {
    const url = await uploadToCloudinary(bytes, mime, opts.kind);
    const row = await db.storedFile.create({
      data: { ownerId: opts.ownerId, kind: opts.kind, mimeType: mime, size: file.size, name: safeName, url, isPublic: true },
    });
    return { id: row.id, url };
  }

  const row = await db.storedFile.create({
    data: {
      ownerId: opts.ownerId,
      kind: opts.kind,
      mimeType: mime,
      size: file.size,
      name: safeName,
      data: Buffer.from(bytes),
      isPublic: !isDocument,
    },
  });
  return { id: row.id, url: `/api/files/${row.id}` };
}

async function uploadToCloudinary(bytes: Uint8Array, mime: string, kind: FileKind) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `mydrivez/${kind.toLowerCase()}`;
  const toSign = `folder=${folder}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");
  const form = new FormData();
  form.append("file", `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`);
  form.append("api_key", env.cloudinary.apiKey!);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new UploadError("Image upload failed. Please try again.");
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}
