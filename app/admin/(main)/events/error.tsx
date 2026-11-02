"use client";

import { RouteError } from "@/components/admin/route-error";

export default function AdminEventsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} scope="admin/events" />;
}
