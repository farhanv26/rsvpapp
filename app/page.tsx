import { redirect } from "next/navigation";
import { getOptionalAdminUser } from "@/lib/admin-auth";

export default async function Home() {
  const admin = await getOptionalAdminUser();
  if (admin) {
    redirect("/admin/events");
  }
  redirect("/admin/login");
}
