import Link from "next/link";
import {
  reassignGuestAction,
  releaseGuestPlacesAction,
  setEventGuestRoleAction,
  setGuestAllowanceAction,
} from "@/app/admin/events/guest-list-actions";
import type { GuestListPermission } from "@/lib/guest-permissions";

export type GuestListMember = {
  userId: string;
  name: string;
  role: "organizer" | "contributor" | null;
  canManageAllGuests: boolean;
  allocation: { places: number; used: number; remaining: number; households: number; declinedPlaces: number } | null;
};

export type HeldDeclinedGuest = { id: string; guestName: string; places: number; managerName: string | null };

/** "62 of 75 places allocated", with the state carried in words as well as colour. */
export function AllowanceSummary({ used, places }: { used: number; places: number }) {
  const left = places - used;
  return (
    <span className="tabular-nums">
      {used} of {places} places allocated
      <span className={left < 0 ? "font-medium text-[var(--danger)]" : left === 0 ? "font-medium text-[var(--warning)]" : "text-[var(--muted-text)]"}>
        {left < 0 ? ` · ${-left} over` : left === 0 ? " · none left" : ` · ${left} left`}
      </span>
    </span>
  );
}

export function GuestListAccess({
  eventId,
  perm,
  members,
  unallocatedPlaces,
  declinedHolding,
  managedByFilter,
  message,
  error,
}: {
  eventId: string;
  perm: GuestListPermission;
  members: GuestListMember[];
  unallocatedPlaces: number;
  declinedHolding: HeldDeclinedGuest[];
  managedByFilter: string | null;
  message: string | null;
  error: string | null;
}) {
  const feedback = error ? (
    <p className="notice-error mb-3" role="alert">
      {error}
    </p>
  ) : message ? (
    <p className="notice-success mb-3" role="status">
      {message}
    </p>
  ) : null;

  if (perm.level === "contributor") {
    const mine = members.find((m) => m.userId === perm.actorId)?.allocation;
    return (
      <section id="guest-list-access" className="scroll-mt-24" aria-labelledby="gla-title">
        <h2 id="gla-title" className="section-heading">
          Your guest list
        </h2>
        {feedback}
        <p className="mt-1 text-sm">
          {mine ? <AllowanceSummary used={mine.used} places={mine.places} /> : "You don't have an allowance for this event yet. Ask an organizer to set one."}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-text)]">
          You can add and edit your own households. Places stay reserved when a household declines until an organizer releases them.
          {perm.canManageAllGuests ? " You can also edit other members' households." : ""}
        </p>
      </section>
    );
  }

  return (
    <section id="guest-list-access" className="scroll-mt-24" aria-labelledby="gla-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gla-title" className="section-heading">
          Guest lists and allowances
        </h2>
        {managedByFilter ? (
          <Link href={`/admin/events/${eventId}?tab=guests`} className="text-link text-sm">
            Show everyone&apos;s households
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[var(--muted-text)]">
        {perm.rolesConfigured
          ? "Contributors see and edit only their own households, within their allowance."
          : "Everyone in this wedding can edit every household. Make someone a contributor to give them their own list and allowance."}
      </p>
      <div className="mt-3">{feedback}</div>

      <ul className="list-rows">
        {members.map((m) => (
          <li key={m.userId} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <div className="min-w-0">
              <p className="font-medium">
                {m.name}
                {m.userId === perm.actorId ? <span className="font-normal text-[var(--muted-text)]"> (you)</span> : null}
              </p>
              <p className="text-sm">
                {m.allocation ? (
                  <>
                    <AllowanceSummary used={m.allocation.used} places={m.allocation.places} />
                    <span className="text-[var(--muted-text)]"> · {m.allocation.households} households · </span>
                    <Link href={`/admin/events/${eventId}?tab=guests&managedBy=${encodeURIComponent(m.userId)}`} className="text-link">
                      View list
                    </Link>
                  </>
                ) : (
                  <span className="text-[var(--muted-text)]">No allowance</span>
                )}
              </p>
            </div>
            <form action={setEventGuestRoleAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="userId" value={m.userId} />
              <label className="sr-only" htmlFor={`role-${m.userId}`}>
                Role for {m.name}
              </label>
              <select id={`role-${m.userId}`} name="role" defaultValue={m.role ?? "none"} className="input-luxe mt-0 w-auto">
                <option value="none">Organizer (default)</option>
                <option value="organizer">Organizer</option>
                <option value="contributor">Contributor</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted-text)]">
                <input type="checkbox" name="canManageAllGuests" defaultChecked={m.canManageAllGuests} className="h-4 w-4 accent-[var(--foreground)]" />
                Can edit all households
              </label>
              <button type="submit" className="btn-secondary btn-sm">
                Save
              </button>
            </form>
            <form action={setGuestAllowanceAction} className="flex items-center gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="userId" value={m.userId} />
              <label className="text-xs text-[var(--muted-text)]" htmlFor={`places-${m.userId}`}>
                Places
              </label>
              <input
                id={`places-${m.userId}`}
                name="places"
                type="number"
                inputMode="numeric"
                min={m.allocation?.used ?? 0}
                step={1}
                defaultValue={m.allocation?.places ?? ""}
                placeholder="None"
                className="input-luxe mt-0 w-20 tabular-nums"
              />
              <button type="submit" className="btn-secondary btn-sm">
                Set
              </button>
            </form>
          </li>
        ))}
      </ul>
      {unallocatedPlaces > 0 ? (
        <p className="mt-2 text-xs text-[var(--muted-text)]">{unallocatedPlaces} places are on the organizers&apos; list and don&apos;t count against anyone&apos;s allowance.</p>
      ) : null}

      {declinedHolding.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Declined households still holding places</h3>
          <p className="mt-0.5 text-xs text-[var(--muted-text)]">Release their places to give the contributor room again.</p>
          <ul className="list-rows mt-2">
            {declinedHolding.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {g.guestName}
                  <span className="text-[var(--muted-text)]">
                    {" "}
                    · {g.places} places{g.managerName ? ` · ${g.managerName}'s list` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  <form action={releaseGuestPlacesAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="guestId" value={g.id} />
                    <button type="submit" className="btn-secondary btn-sm">
                      Release places
                    </button>
                  </form>
                  <form action={reassignGuestAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="guestId" value={g.id} />
                    <input type="hidden" name="targetUserId" value="" />
                    <button type="submit" className="btn-ghost btn-sm">
                      Move to organizers&apos; list
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
