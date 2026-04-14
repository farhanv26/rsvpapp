import "server-only";

import { createClient } from "@supabase/supabase-js";
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "event-invites";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const hasSupabaseUrl = Boolean(supabaseUrl);
    const hasServiceRoleKey = Boolean(supabaseServiceRoleKey);
    console.error("[event-image] missing Supabase storage env vars", {
      hasSupabaseUrl,
      hasServiceRoleKey,
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV ?? null,
    });
    const missing = [
      !hasSupabaseUrl ? "SUPABASE_URL" : null,
      !hasServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean);
    throw new Error(`Image upload storage is not configured. Missing: ${missing.join(", ")}.`);
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const filename = `${Date.now()}-${generateSecureToken().slice(0, 12)}.${ext}`;
  const objectPath = `${filename}`;
  console.info("[event-image] upload received", {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    storage: "supabase-storage",
    bucket,
  });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const uploadResult = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  });

  if (uploadResult.error) {
    throw new Error(`Image upload failed: ${uploadResult.error.message}`);
  }

  const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = publicUrlResult.data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Image uploaded but public URL could not be generated.");
  }

  console.info("[event-image] saved to supabase storage", {
    bucket,
    objectPath,
    publicUrl,
  });
  return publicUrl;
}
