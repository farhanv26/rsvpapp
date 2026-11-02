"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { saveGuestAction, type GuestFormResult } from "@/app/admin/events/guest-form-actions";
import { GuestPhoneFields } from "@/components/admin/guest-phone-fields";
import { Dialog } from "@/components/admin/ui/dialog";
import { AllowanceRegister } from "@/components/admin/planning-ui";

export type GuestFormGuest = {
  id: string;
  guestName: string;
  greeting: string;
  menCount: number;
  womenCount: number;
  kidsCount: number;
  group: string | null;
  tableName: string | null;
  notes: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  email: string | null;
  isFamilyInvite: boolean;
  excludedMenCount: number;
  excludedWomenCount: number;
  excludedKidsCount: number;
  excludeReason: string | null;
  countOwnerEventId: string | null;
  isSharedGuest: boolean;
};

export type GuestFormEvent = {
  id: string;
  title: string;
  /** The signed-in member's own allowance on this event, when they are a contributor. */
  allowance: { places: number; used: number } | null;
};

const GREETINGS = ["Assalamu Alaikum", "Dear", "Hello", "Hi", "Namaste", "Sat Sri Akal"];

function placesOf(men: number, women: number, kids: number) {
  return Math.max(men, 0) + Math.max(women, 0) + Math.max(kids, 0);
}

export function GuestFormDialog({
  open,
  onClose,
  guest,
  events,
  eventId,
  defaultGreeting = "Assalamu Alaikum",
  inviteCard,
}: {
  open: boolean;
  onClose: () => void;
  /** Present when editing. */
  guest?: GuestFormGuest | null;
  /** Events this household can be added to. One entry hides the event picker. */
  events: GuestFormEvent[];
  eventId?: string;
  defaultGreeting?: string;
  inviteCard?: { usingLine: string; safeSrc: string | null } | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GuestFormResult | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(eventId ?? events[0]?.id ?? "");
  const [men, setMen] = useState(guest?.menCount ?? 0);
  const [women, setWomen] = useState(guest?.womenCount ?? 0);
  const [kids, setKids] = useState(guest?.kidsCount ?? 0);
  const greetingOptions = useMemo(() => Array.from(new Set([defaultGreeting, ...GREETINGS])), [defaultGreeting]);
  const initialGreeting = guest ? guest.greeting : defaultGreeting;
  const [greetingChoice, setGreetingChoice] = useState(greetingOptions.includes(initialGreeting) ? initialGreeting : "custom");

  const editing = Boolean(guest);
  const event = events.find((e) => e.id === selectedEventId) ?? null;
  const total = placesOf(men, women, kids);
  const originalPlaces = guest ? placesOf(guest.menCount, guest.womenCount, guest.kidsCount) : 0;
  const allowance = event?.allowance ?? null;
  const projected = allowance ? allowance.used - originalPlaces + total : null;
  const overAllowance = allowance !== null && projected !== null && projected > allowance.places;
  const error = result && !result.ok ? result : null;

  const hasMoreDetails = Boolean(
    guest && (guest.group || guest.tableName || guest.notes || guest.isFamilyInvite || guest.excludedMenCount || guest.excludedWomenCount || guest.excludedKidsCount),
  );

  useEffect(() => {
    if (!error) return;
    const target =
      error.field === "guestName"
        ? formRef.current?.querySelector<HTMLInputElement>('[name="guestName"]')
        : error.field === "counts"
          ? formRef.current?.querySelector<HTMLInputElement>('[name="menCount"]')
          : error.field === "email"
            ? formRef.current?.querySelector<HTMLInputElement>('[name="email"]')
            : null;
    target?.focus();
  }, [error]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (greetingChoice !== "custom") fd.set("greetingCustom", "");
    else fd.set("greetingPreset", "");
    setResult(null);
    startTransition(async () => {
      const res = await saveGuestAction(fd);
      setResult(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  const countsInvalid = error?.field === "counts";
  const editCount = (set: (n: number) => void) => (n: number) => {
    set(n);
    if (countsInvalid) setResult(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={editing ? `Edit ${guest!.guestName}` : "Add household"}
      description={editing && event ? event.title : undefined}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form="guest-form" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add household"}
          </button>
        </>
      }
    >
      <form id="guest-form" ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
        {error && !error.field ? (
          <p className="notice-error" role="alert">
            {error.error}
          </p>
        ) : null}
        {guest ? (
          <>
            <input type="hidden" name="guestId" value={guest.id} />
            <input type="hidden" name="countOwnerEventId" value={guest.countOwnerEventId ?? ""} />
          </>
        ) : null}

        {events.length > 1 && !editing ? (
          <label className="form-label">
            Event
            <select name="eventId" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="input-luxe" required>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="eventId" value={selectedEventId} />
        )}

        <div>
          <label className="form-label" htmlFor="guest-form-name">
            Household name
          </label>
          <input
            id="guest-form-name"
            name="guestName"
            defaultValue={guest?.guestName ?? ""}
            placeholder="The Khan Family"
            className="input-luxe"
            required
            autoComplete="off"
            aria-invalid={error?.field === "guestName" || undefined}
            aria-describedby={error?.field === "guestName" ? "guest-form-name-error" : undefined}
          />
          {error?.field === "guestName" ? (
            <p id="guest-form-name-error" className="field-error" role="alert">
              {error.error}
            </p>
          ) : null}
        </div>

        <fieldset aria-describedby="guest-form-places">
          <legend className="form-label">Party size</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <CountInput label="Men" name="menCount" value={men} onChange={editCount(setMen)} invalid={countsInvalid} />
            <CountInput label="Women" name="womenCount" value={women} onChange={editCount(setWomen)} invalid={countsInvalid} />
            <CountInput label="Kids" name="kidsCount" value={kids} onChange={editCount(setKids)} invalid={countsInvalid} />
          </div>
          <div id="guest-form-places" className="mt-3" aria-live="polite">
            <p className="text-sm text-[var(--muted-text)] tabular-nums">
              This household takes <span className="font-semibold text-[var(--foreground)]">{total === 1 ? "1 place" : `${total} places`}</span>
            </p>
            {allowance && projected !== null ? (
              <div className="mt-2.5 rounded-md bg-[var(--surface-muted)] px-3 py-2.5">
                <AllowanceRegister compact name={`Your allowance${event ? ` · ${event.title}` : ""}`} used={projected} places={allowance.places} />
                {overAllowance && !countsInvalid ? (
                  <p className="field-error">
                    {projected - allowance.places} over. Reduce the party size or ask an organizer for more places.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {countsInvalid ? (
            <p className="field-error" role="alert">
              {error.error}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <GuestPhoneFields
            defaultCountryCode={guest?.phoneCountryCode ?? null}
            defaultNationalDigits={guest?.phoneCountryCode ? (guest.phone ?? "") : ""}
            legacyPhone={guest && !guest.phoneCountryCode ? guest.phone : null}
          />
          <div>
            <label className="form-label" htmlFor="guest-form-email">
              Email
            </label>
            <input
              id="guest-form-email"
              name="email"
              type="email"
              defaultValue={guest?.email ?? ""}
              placeholder="name@example.com"
              className="input-luxe"
              autoComplete="off"
              aria-invalid={error?.field === "email" || undefined}
            />
            {error?.field === "email" ? (
              <p className="field-error" role="alert">
                {error.error}
              </p>
            ) : null}
          </div>
        </div>

        <details className="group rounded-md border border-[var(--border-soft)]" open={hasMoreDetails || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Greeting, group, table and notes
            <ChevronDown className="h-4 w-4 text-[var(--muted-text)] transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-4 border-t border-[var(--border-soft)] p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">
                Greeting
                <select
                  name="greetingPreset"
                  value={greetingChoice}
                  onChange={(e) => setGreetingChoice(e.target.value)}
                  className="input-luxe"
                >
                  {greetingOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="custom">Other…</option>
                </select>
              </label>
              {greetingChoice === "custom" ? (
                <label className="form-label">
                  Custom greeting
                  <input name="greetingCustom" defaultValue={greetingOptions.includes(initialGreeting) ? "" : initialGreeting} className="input-luxe" maxLength={80} />
                </label>
              ) : null}
              <label className="form-label">
                Group
                <input name="group" defaultValue={guest?.group ?? ""} placeholder="Bride's family" className="input-luxe" maxLength={120} />
              </label>
              <label className="form-label">
                Table
                <input name="tableName" defaultValue={guest?.tableName ?? ""} placeholder="Table 4" className="input-luxe" maxLength={120} />
              </label>
            </div>
            <label className="form-label">
              Notes
              <input name="notes" defaultValue={guest?.notes ?? ""} className="input-luxe" />
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="isFamilyInvite" value="true" defaultChecked={guest?.isFamilyInvite} className="mt-0.5 h-4 w-4" />
              <span>
                Family invitation
                <span className="block text-xs text-[var(--muted-text)]">Uses the family invitation card when the event has one.</span>
              </span>
            </label>

            {guest ? (
              <fieldset className="space-y-2 border-t border-[var(--border-soft)] pt-4">
                <legend className="text-sm font-medium">Already counted at another event</legend>
                <p className="text-xs text-[var(--muted-text)]">
                  People counted elsewhere are left out of this event&apos;s totals. Leave at 0 to count everyone here.
                  {guest.isSharedGuest ? " This household is also invited to other events." : ""}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <ExcludedSelect label="Men" name="excludedMenCount" max={men} defaultValue={guest.excludedMenCount} />
                  <ExcludedSelect label="Women" name="excludedWomenCount" max={women} defaultValue={guest.excludedWomenCount} />
                  <ExcludedSelect label="Kids" name="excludedKidsCount" max={kids} defaultValue={guest.excludedKidsCount} />
                </div>
                <label className="form-label">
                  Reason (optional)
                  <input name="excludeReason" defaultValue={guest.excludeReason ?? ""} placeholder="Counted at the Mehndi" className="input-luxe" />
                </label>
              </fieldset>
            ) : null}

            {inviteCard ? (
              <div className="flex items-center gap-3 border-t border-[var(--border-soft)] pt-4 text-sm">
                {inviteCard.safeSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small admin preview
                  <img src={inviteCard.safeSrc} alt="" className="h-14 w-14 rounded-md border border-[var(--border-soft)] object-cover" />
                ) : null}
                <span className="text-[var(--muted-text)]">Invitation card: {inviteCard.usingLine.replace(/^Using:\s*/, "")}</span>
              </div>
            ) : null}
          </div>
        </details>
      </form>
    </Dialog>
  );
}

function CountInput({
  label,
  name,
  value,
  onChange,
  invalid,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (n: number) => void;
  invalid?: boolean;
}) {
  return (
    <label className="text-xs text-[var(--muted-text)]">
      {label}
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0))}
        onFocus={(e) => e.currentTarget.select()}
        className="input-luxe mt-1 text-center tabular-nums"
        aria-invalid={invalid || undefined}
        required
      />
    </label>
  );
}

function ExcludedSelect({ label, name, max, defaultValue }: { label: string; name: string; max: number; defaultValue: number }) {
  return (
    <label className="text-xs text-[var(--muted-text)]">
      {label}
      <select name={name} defaultValue={String(Math.min(defaultValue, max))} className="input-luxe mt-1">
        {Array.from({ length: Math.max(max, 0) + 1 }, (_, i) => (
          <option key={i} value={String(i)}>
            {i}
          </option>
        ))}
      </select>
    </label>
  );
}
