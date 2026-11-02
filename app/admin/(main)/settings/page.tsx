import Link from "next/link";
import { saveWeddingSettingsAction } from "@/app/admin/planning/actions";
import { Feedback, NoWeddingSelected, PageHeader } from "@/components/admin/planning-ui";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { loadPlanningPage } from "@/lib/workspace-page";

export const dynamic = "force-dynamic";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
];
const GREETINGS = ["Assalamu Alaikum", "Dear", "Namaste", "Sat Sri Akal", "Hello"];

type Props = { searchParams?: Promise<{ saved?: string; error?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const { workspace, wedding, isOwner } = await loadPlanningPage();
  if (!wedding) {
    return (
      <main className="app-shell">
        <PageHeader title="Settings" />
        <NoWeddingSelected hasWeddings={workspace.weddings.length > 0} />
      </main>
    );
  }
  const members = await prisma.weddingMembership.findMany({
    where: { weddingId: wedding.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, role: true, user: { select: { name: true } } },
  });

  return (
    <main className="app-shell">
      <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" meta={wedding.name} />
      <Feedback saved={sp.saved} error={sp.error} />

      <section className="app-card p-4 sm:p-5" aria-labelledby="wedding-settings">
        <h2 id="wedding-settings" className="section-heading">Wedding</h2>
        {!isOwner ? <p className="mt-1 text-sm text-[var(--muted-text)]">Only owners can change these settings.</p> : null}
        <form action={saveWeddingSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="weddingId" value={wedding.id} />
          <fieldset disabled={!isOwner} className="contents">
            <label className="form-label sm:col-span-2">
              Name
              <input name="name" required maxLength={120} defaultValue={wedding.name} className="input-luxe" />
            </label>
            <label className="form-label">
              Currency
              <select name="currency" defaultValue={wedding.currency} className="input-luxe" aria-describedby="currency-help">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <span id="currency-help" className="field-hint block font-normal">Locked once the budget has lines.</span>
            </label>
            <label className="form-label">
              Timezone
              <select name="timezone" defaultValue={wedding.timezone ?? ""} className="input-luxe">
                <option value="">Not set</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
            </label>
            <label className="form-label sm:col-span-2">
              Greeting for new households
              <input name="defaultGreeting" list="greeting-options" maxLength={80} defaultValue={wedding.defaultGreeting ?? ""} placeholder="Assalamu Alaikum" className="input-luxe" aria-describedby="greeting-help" />
              <datalist id="greeting-options">
                {GREETINGS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <span id="greeting-help" className="field-hint block font-normal">
                Used as the default when adding households. Greetings already set on households are never changed.
              </span>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Save settings</button>
            </div>
          </fieldset>
        </form>
      </section>

      <section className="app-card p-4 sm:p-5" aria-labelledby="members">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="members" className="section-heading">Members</h2>
          <Link href={`/admin/weddings?w=${encodeURIComponent(wedding.id)}#members`} className="text-link text-sm">
            {isOwner ? "Add or change members" : "View members"}
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-[var(--border-soft)] text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex justify-between py-2">
              <span>{m.user.name}</span>
              <span className="text-[var(--muted-text)]">{m.role === "owner" ? "Owner" : "Member"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted-text)]">
          Members can plan everything in this wedding. To limit someone to their own guest list, make them a contributor with an allowance in an event&apos;s Settings tab.
        </p>
      </section>

      <p className="text-sm text-[var(--muted-text)]">
        Planning another wedding? <Link href="/admin/weddings" className="text-link">See all weddings</Link>.
      </p>
      </div>
    </main>
  );
}
