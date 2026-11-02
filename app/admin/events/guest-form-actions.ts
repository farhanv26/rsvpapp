"use server";

import { unstable_rethrow } from "next/navigation";
import { createGuestAction, updateGuestAction } from "@/app/admin/events/actions";
import { GuestListPermissionError } from "@/lib/guest-permissions";
import { GuestFieldError } from "@/lib/validation";

export type GuestFormResult =
  | { ok: true }
  | { ok: false; error: string; field: "guestName" | "counts" | "email" | null };

/**
 * Add or edit a household and report expected failures (validation, allowance, duplicates) as
 * data, so the form can show them inline and keep what the user typed.
 */
export async function saveGuestAction(formData: FormData): Promise<GuestFormResult> {
  try {
    if (String(formData.get("guestId") ?? "")) await updateGuestAction(formData);
    else await createGuestAction(formData);
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof GuestListPermissionError) {
      return { ok: false, error: err.message, field: err.code === "allowance_exceeded" ? "counts" : null };
    }
    if (err instanceof GuestFieldError) {
      const field = err.field === "guestName" || err.field === "email" ? err.field : err.field?.endsWith("Count") ? "counts" : null;
      return { ok: false, error: err.message, field };
    }
    if (err instanceof Error && /^(Guest not found|You are not allowed|Event not found)/.test(err.message)) {
      return { ok: false, error: err.message, field: null };
    }
    console.error("[guests] save failed", err);
    return { ok: false, error: "Couldn't save this household. Please try again.", field: null };
  }
}
