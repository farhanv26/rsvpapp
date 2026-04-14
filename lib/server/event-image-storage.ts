import "server-only";

import { put } from "@vercel/blob";
import { generateSecureToken } from "@/lib/security";
import { validateEventImageFile } from "@/lib/event-image";

export async function saveEventImage(file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  const error = validateEventImageFile(file);
  if (error) {
    throw new Error(error);
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const filename = `${Date.now()}-${generateSecureToken().slice(0, 12)}.${ext}`;
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  console.info("[event-image] upload received", {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    storage: hasBlobToken ? "vercel-blob" : "not-configured",
  });

  if (!hasBlobToken) {
    throw new Error("Image upload storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }

  const blobPath = `event-invites/${filename}`;
  const uploaded = await put(blobPath, file, {
    access: "public",
    addRandomSuffix: false,
  });
  console.info("[event-image] saved to blob", {
    blobPath,
    url: uploaded.url,
  });
  return uploaded.url;
}
