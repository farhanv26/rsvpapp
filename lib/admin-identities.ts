export type AdminRole = "super_admin" | "event_creator";

export const ADMIN_IDENTITIES: Array<{ name: string; role: AdminRole }> = [
  { name: "Farhan", role: "super_admin" },
  { name: "Zulfikar", role: "event_creator" },
  { name: "Asif", role: "event_creator" },
  { name: "Javed", role: "event_creator" },
  { name: "Rafiya", role: "event_creator" },
];
