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

/** One ruled settings row: what it is on the left, the controls on the right. */
function SettingsSection({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-x-10 gap-y-3 border-t border-[var(--border-strong)] py-6 md:grid-cols-[12rem_minmax(0,1fr)]">
      <div>
        <h2 id={id} className="section-heading">
          {title}
        </h2>
        {aside ? <div className="mt-1 text-[13px] text-[var(--muted-text)]">{aside}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

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
      <div className="max-w-4xl">
        <PageHeader title="Settings" meta={wedding.name} />
        <Feedback saved={sp.saved} error={sp.error} />

        <SettingsSection id="wedding-settings" title="Wedding" aside={!isOwner ? "Only owners can change these." : null}>
          <form action={saveWeddingSettingsAction} className="grid gap-4 sm:grid-cols-2">
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
                <span id="currency-help" className="field-hint block font-normal">
                  Locked once the budget has lines.
                </span>
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
                <input
                  name="defaultGreeting"
                  list="greeting-options"
                  maxLength={80}
                  defaultValue={wedding.defaultGreeting ?? ""}
                  placeholder="Assalamu Alaikum"
                  className="input-luxe"
                  aria-describedby="greeting-help"
                />
                <datalist id="greeting-options">
                  {GREETINGS.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <span id="greeting-help" className="field-hint block font-normal">
                  Households that already have a greeting keep it.
                </span>
              </label>
              {isOwner ? (
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary">
                    Save settings
                  </button>
                </div>
              ) : null}
            </fieldset>
          </form>
        </SettingsSection>

        <SettingsSection
          id="members"
          title="Members"
          aside={
            <>
              Members plan everything. To limit someone to their own guests, make them a contributor in an event&apos;s Allowances tab.
            </>
          }
        >
          <ul className="list-rows text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="font-medium break-words">{m.user.name}</span>
                <span className="shrink-0 text-[var(--muted-text)]">{m.role === "owner" ? "Owner" : "Member"}</span>
              </li>
            ))}
          </ul>
          <Link href={`/admin/weddings?w=${encodeURIComponent(wedding.id)}#members`} className="btn-secondary mt-3">
            {isOwner ? "Manage members" : "View members"}
          </Link>
        </SettingsSection>

        <SettingsSection id="other-weddings" title="Other weddings">
          <Link href="/admin/weddings" className="text-link text-sm">
            See all weddings or create another
          </Link>
        </SettingsSection>
      </div>
    </main>
  );
}
