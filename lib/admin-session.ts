import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = process.env.VOWPAL_DEMO === "1" ? "vowpal_demo_session" : "admin_session";
type AdminSessionClaims = {
  role: "admin";
  userId: string;
  name: string;
  userRole: "super_admin" | "event_creator";
};

function getSecretBytes() {
  const s = process.env.ADMIN_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_AUTH_SECRET must be set and at least 16 characters.");
  }
  return new TextEncoder().encode(s);
}

export async function createAdminSessionToken(user: {
  userId: string;
  name: string;
  userRole: "super_admin" | "event_creator";
}) {
  const secret = getSecretBytes();
  return await new SignJWT({ role: "admin", ...user } satisfies AdminSessionClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAdminSessionToken(token: string) {
  const secret = getSecretBytes();
  await jwtVerify(token, secret);
}

export async function readAdminSessionToken(token: string) {
  const secret = getSecretBytes();
  const { payload } = await jwtVerify(token, secret);
  // A missing userId would turn `findFirst({ where: { id: undefined } })` into "any user".
  if (payload.role !== "admin" || typeof payload.userId !== "string" || !payload.userId) {
    throw new Error("Invalid admin session token.");
  }
  return payload as AdminSessionClaims;
}
