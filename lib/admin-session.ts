import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "admin_session";

function getSecretBytes() {
  const s = process.env.ADMIN_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_AUTH_SECRET must be set and at least 16 characters.");
  }
  return new TextEncoder().encode(s);
}

export async function createAdminSessionToken() {
  const secret = getSecretBytes();
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAdminSessionToken(token: string) {
  const secret = getSecretBytes();
  await jwtVerify(token, secret);
}
