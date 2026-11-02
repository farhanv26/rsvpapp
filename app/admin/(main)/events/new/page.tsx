import Link from "next/link";
import { FormSection, Optional, Required } from "@/components/admin/form-section";
import { PageHeader } from "@/components/admin/planning-ui";
import { createEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventFontStyleField } from "@/components/admin/event-font-style-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";
import { EventItineraryFields } from "@/components/admin/event-itinerary-fields";
import { redirect } from "next/navigation";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { resolveActiveWorkspace } from "@/lib/wedding-access";
import { isPlatformSuperAdmin } from "@/lib/wedding-policy";

export default async function NewEventPage() {
  const admin = await requireCurrentAdminUser();
  const workspace = await resolveActiveWorkspace(admin);
  const weddingChoices = workspace.weddings.filter((w) => isPlatformSuperAdmin(admin) || w.role !== null);
  if (weddingChoices.length === 0) {
    redirect("/admin/weddings?notice=create_first");
  }
  const defaultWeddingId = workspace.activeWedding?.id ?? weddingChoices[0]!.id;
  return (
    <main className="app-shell">

      <PageHeader title="New event" back={{ href: "/admin/events", label: "Events" }} />

      <form action={createEventAction} className="max-w-4xl">

        {/* ── 1. Identity ── */}
        <FormSection title="Names" description="Shown at the top of the invitation.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="weddingId" className="form-label">
                Wedding <Required />
              </label>
              <select
                id="weddingId"
                name="weddingId"
                defaultValue={defaultWeddingId}
                className="input-luxe mt-0"
                required
              >
                {weddingChoices.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
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
                placeholder="Aisha &amp; Omar"
                className="input-luxe mt-0"
              />
              <p className="mt-1.5 text-xs text-[var(--muted-text)]">Shown as the large heading on the invitation page.</p>
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
        <FormSection title="Date and replies" description="When it happens and when replies close.">
          <div className="grid gap-4 sm:grid-cols-2">
            <EventSchedulingFields />
          </div>
        </FormSection>

        {/* ── 3. Typography ── */}
        <EventFontStyleField />

        {/* ── 4. Venue & messaging ── */}
        <FormSection title="Venue and wording" description="Where it is and what guests read.">
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
            <div className="border-t border-[var(--border-soft)] pt-4">
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
                    placeholder="You are cordially invited to Aisha &amp; Omar's Nikkah Ceremony"
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
        <FormSection title="Invitation card" description="Upload the main invite image guests see on their page.">
          <EventImageUploadField />
        </FormSection>

        {/* ── 6. Itinerary ── */}
        <FormSection title="Itinerary" description="Optional day-of schedule shown to guests on their invite.">
          <EventItineraryFields />
        </FormSection>

        {/* ── Submit footer ── */}
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0 lg:bottom-0">
          <Link href="/admin/events" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Create event
          </button>
        </div>

      </form>
    </main>
  );
}

