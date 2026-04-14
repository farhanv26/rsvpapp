import { randomBytes } from "node:crypto";

export function generateSecureToken() {
  return randomBytes(32).toString("hex");
}
