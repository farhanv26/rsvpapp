import Link from "next/link";
import { createEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventFontStyleField } from "@/components/admin/event-font-style-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";
import { EventItineraryFields } from "@/components/admin/event-itinerary-fields";
import { requireCurrentAdminUser } from "@/lib/admin-auth";

export default async function NewEventPage() {
  await requireCurrentAdminUser();
  return (
    <main className="app-shell max-w-4xl">

      {/* ── Back + heading ── */}
      <div className="mb-8">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:text-zinc-700"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden>
            <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Events
        </Link>
        <h1 className="headline-display mt-3">Create event</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Set up the core details. Guests and invite links are added after.
        </p>
      </div>

      <form action={createEventAction} className="space-y-5">

        {/* ── 1. Identity ── */}
        <FormSection number="01" title="Identity" description="Names and headline shown on the guest invite page.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="form-label">
                Event title <Required />
              </label>
              <input
                id="title"
                name="title"
                type="text"
                placeholder="Nikkah Ceremony"
                className="input-luxe mt-0"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="coupleNames" className="form-label">
                Couple names <Optional />
              </label>
              <input
                id="coupleNames"
                name="coupleNames"
                type="text"
                placeholder="Farhan &amp; Rafiya"
                className="input-luxe mt-0"
              />
              <p className="mt-1.5 text-xs text-zinc-400">Shown as the large heading on the invitation page.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eventSubtitle" className="form-label">
                Subtitle <Optional />
              </label>
              <input
                id="eventSubtitle"
                name="eventSubtitle"
                type="text"
                placeholder="Together with their families…"
                className="input-luxe mt-0"
              />
            </div>
          </div>
        </FormSection>

        {/* ── 2. Schedule ── */}
        <FormSection number="02" title="Schedule" description="Ceremony date, time, and RSVP cutoff.">
          <div className="grid gap-4 sm:grid-cols-2">
            <EventSchedulingFields />
          </div>
        </FormSection>

        {/* ── 3. Typography ── */}
        <EventFontStyleField />

        {/* ── 4. Venue & messaging ── */}
        <FormSection number="04" title="Venue & messaging" description="Location and what guests see on their invite.">
          <div className="space-y-4">
            <div>
              <label htmlFor="venue" className="form-label">
                Venue <Optional />
              </label>
              <input
                id="venue"
                name="venue"
                type="text"
                placeholder="Rosewood Estate, Napa Valley"
                className="input-luxe mt-0"
              />
            </div>
            <div>
              <label htmlFor="welcomeMessage" className="form-label">
                Welcome message <Optional />
              </label>
              <textarea
                id="welcomeMessage"
                name="welcomeMessage"
                className="input-luxe mt-0 h-24 resize-none"
                placeholder="We are so excited to celebrate with you."
              />
            </div>
            <div>
              <label htmlFor="description" className="form-label">
                Description <Optional />
              </label>
              <textarea
                id="description"
                name="description"
                className="input-luxe mt-0 h-24 resize-none"
              />
            </div>
            <div className="border-t border-[#ece4d4] pt-4">
              <p className="form-label mb-3">WhatsApp / iMessage invite overrides <Optional /></p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="inviteMessageIntro" className="mb-1.5 block text-xs text-zinc-500">
                    Intro line
                  </label>
                  <input
                    id="inviteMessageIntro"
                    name="inviteMessageIntro"
                    type="text"
                    className="input-luxe mt-0"
                    placeholder="You are cordially invited to Farhan &amp; Rafiya's Nikkah Ceremony"
                  />
                </div>
                <div>
                  <label htmlFor="inviteMessageLineOverride" className="mb-1.5 block text-xs text-zinc-500">
                    Second line
                  </label>
                  <input
                    id="inviteMessageLineOverride"
                    name="inviteMessageLineOverride"
                    type="text"
                    className="input-luxe mt-0"
                    placeholder="Your presence would truly make this event special."
                  />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── 5. Invitation card ── */}
        <FormSection number="05" title="Invitation card" description="Upload the main invite image guests see on their page.">
          <EventImageUploadField />
        </FormSection>

        {/* ── 6. Itinerary ── */}
        <FormSection number="06" title="Itinerary" description="Optional day-of schedule shown to guests on their invite.">
          <EventItineraryFields />
        </FormSection>

        {/* ── Submit footer ── */}
        <div className="flex flex-col-reverse gap-2 rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/events" className="btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-44">
            Create event
          </button>
        </div>

      </form>
    </main>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#e7dccb] bg-[#fffdfa] shadow-[0_4px_24px_-12px_rgba(71,52,29,0.18)]">
      <div className="border-b border-[#ece4d4] px-6 py-4 sm:px-7">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] font-semibold tracking-[0.22em] text-zinc-400">{number}</span>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
        <p className="mt-0.5 pl-8 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="p-6 sm:p-7">{children}</div>
    </section>
  );
}

function Required() {
  return <span className="ml-1 text-zinc-400">*</span>;
}

function Optional() {
  return <span className="ml-1 font-normal text-zinc-400">(optional)</span>;
}
