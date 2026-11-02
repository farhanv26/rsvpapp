import "server-only";

import { SignJWT, jwtVerify } from "jose";

const AUDIENCE = "rsvp-event-preview";
export const PREVIEW_TOKEN_TTL_SECONDS = 10 * 60;

/** Derived key: preview tokens can never verify as admin sessions (and vice versa). */
async function previewKey(): Promise<Uint8Array> {
  const s = process.env.ADMIN_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_AUTH_SECRET must be set and at least 16 characters.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rsvp-preview:v1:${s}`));
  return new Uint8Array(digest);
}

/** A read-only, single-event preview grant that expires after 10 minutes. */
export async function createEventPreviewToken(input: { userId: string; eventId: string }) {
  return new SignJWT({ purpose: "event_preview", eventId: input.eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PREVIEW_TOKEN_TTL_SECONDS}s`)
    .sign(await previewKey());
}

export async function readEventPreviewToken(token: string): Promise<{ userId: string; eventId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, await previewKey(), { audience: AUDIENCE });
    if (payload.purpose !== "event_preview" || typeof payload.eventId !== "string" || typeof payload.sub !== "string") {
      return null;
    }
    return { userId: payload.sub, eventId: payload.eventId };
  } catch {
    return null;
  }
}
