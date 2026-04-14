export type AdminRoleValue = "super_admin" | "event_creator";

export function formatAdminRoleLabel(role: string): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "event_creator") return "Event Creator";
  return role;
}
