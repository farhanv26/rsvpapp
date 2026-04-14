import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
  console.info("[event-image] upload received", {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    storage: process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local-fallback",
  });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));
  const savedPath = `/uploads/${filename}`;
  console.info("[event-image] saved to local path", {
    filePath,
    publicPath: savedPath,
  });
  return savedPath;
}
