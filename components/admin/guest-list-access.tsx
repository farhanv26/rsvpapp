import Link from "next/link";
import {
  reassignGuestAction,
  releaseGuestPlacesAction,
  setEventGuestRoleAction,
  setGuestAllowanceAction,
} from "@/app/admin/events/guest-list-actions";
import type { GuestListPermission } from "@/lib/guest-permissions";
import { AllowanceRegister } from "@/components/admin/planning-ui";

export type GuestListMember = {
  userId: string;
  name: string;
  role: "organizer" | "contributor" | null;
  canManageAllGuests: boolean;
  allocation: { places: number; used: number; remaining: number; households: number; declinedPlaces: number } | null;
};

export type HeldDeclinedGuest = { id: string; guestName: string; places: number; managerName: string | null };

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
        <h2 id="gla-title" className="sr-only">
          Your allowance
        </h2>
        {feedback}
        {mine ? (
          <AllowanceRegister used={mine.used} places={mine.places} declinedPlaces={mine.declinedPlaces} />
        ) : (
          <p className="notice-warning">You don&apos;t have an allowance for this event yet. Ask an organizer to set one.</p>
        )}
        <ul className="mt-4 space-y-1 text-sm text-[var(--muted-text)]">
          <li>You add and edit your own households{perm.canManageAllGuests ? ", and can also edit everyone else's" : ""}.</li>
          <li>A household that declines keeps its places until an organizer releases them.</li>
        </ul>
      </section>
    );
  }

  return (
    <section id="guest-list-access" className="scroll-mt-24" aria-labelledby="gla-title">
      <h2 id="gla-title" className="sr-only">
        Allowances
      </h2>
      {managedByFilter ? (
        <Link href={`/admin/events/${eventId}?tab=guests`} className="text-link text-sm">
          Show everyone&apos;s households
        </Link>
      ) : null}
      <p className="text-sm text-[var(--muted-text)]">
        {perm.rolesConfigured
          ? "Contributors see and edit only their own households, up to their places."
          : "Everyone in this wedding can edit every household. Make someone a contributor to give them their own list and places."}
      </p>
      <div className="mt-3">{feedback}</div>

      <ul className="list-rows">
        {members.map((m) => (
          <li key={m.userId} className="grid gap-x-6 gap-y-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <p className="font-semibold">
                {m.name}
                {m.userId === perm.actorId ? <span className="font-normal text-[var(--muted-text)]"> (you)</span> : null}
              </p>
              {m.allocation ? (
                <div className="mt-2 max-w-sm">
                  <AllowanceRegister compact used={m.allocation.used} places={m.allocation.places} declinedPlaces={m.allocation.declinedPlaces} />
                  <p className="mt-1.5 text-[13px] text-[var(--muted-text)]">
                    {m.allocation.households} {m.allocation.households === 1 ? "household" : "households"} ·{" "}
                    <Link href={`/admin/events/${eventId}?tab=guests&managedBy=${encodeURIComponent(m.userId)}`} className="text-link">
                      View list
                    </Link>
                  </p>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-[var(--muted-text)]">{m.role === "contributor" ? "No places yet" : "Organizer · no limit"}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
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
                <label className="flex min-h-9 items-center gap-1.5 text-[13px] text-[var(--muted-text)]">
                  <input type="checkbox" name="canManageAllGuests" defaultChecked={m.canManageAllGuests} className="h-4 w-4" />
                  Can edit all households
                </label>
                <button type="submit" className="btn-secondary btn-sm">
                  Save role
                </button>
              </form>
              <form action={setGuestAllowanceAction} className="flex items-center gap-2 sm:border-l sm:border-[var(--border-soft)] sm:pl-3">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="userId" value={m.userId} />
                <label className="text-[13px] text-[var(--muted-text)]" htmlFor={`places-${m.userId}`}>
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
                  Set places
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {unallocatedPlaces > 0 ? (
        <p className="mt-2 text-[13px] text-[var(--muted-text)] tabular-nums">
          {`${unallocatedPlaces} places are on the organizers’ list and don’t count against anyone’s allowance.`}
        </p>
      ) : null}

      {declinedHolding.length > 0 ? (
        <div className="mt-8">
          <h3 className="section-heading text-[15px]">Declined, still holding places</h3>
          <p className="mt-0.5 text-[13px] text-[var(--muted-text)]">Release their places to give the contributor room again.</p>
          <ul className="list-rows mt-2">
            {declinedHolding.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{g.guestName}</span>
                  <span className="text-[var(--muted-text)] tabular-nums">
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
