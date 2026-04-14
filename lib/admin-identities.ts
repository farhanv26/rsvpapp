import type { AdminRoleValue } from "@/lib/admin-roles";

/**
 * Default bootstrap super admin for empty databases (`prisma db seed` only).
 * Runtime user lists come from the database.
 */
export const BOOTSTRAP_SUPER_ADMIN: { name: string; role: AdminRoleValue } = {
  name: "Farhan",
  role: "super_admin",
};
