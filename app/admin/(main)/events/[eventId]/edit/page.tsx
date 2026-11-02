import Link from "next/link";
import { FormSection, Optional, Required } from "@/components/admin/form-section";
import { PageHeader } from "@/components/admin/planning-ui";
import { notFound, redirect } from "next/navigation";
import { updateEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventFontStyleField } from "@/components/admin/event-font-style-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";
import { EventItineraryFields } from "@/components/admin/event-itinerary-fields";
import { SafeEventImage } from "@/components/safe-event-image";
import { RsvpPreviewModal } from "@/components/admin/rsvp-preview-modal";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { getEventAccess } from "@/lib/wedding-access";
import { getGuestListPermission } from "@/lib/guest-allocation";
import { prisma } from "@/lib/prisma";
import { getSafeImageSrc } from "@/lib/utils";
import type { ItineraryItem } from "@/components/itinerary-timeline";

type Props = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: Props) {
  const admin = await requireCurrentAdminUser();
  const { eventId } = await params;
  if ((await getEventAccess(admin, eventId)).status !== "ok") {
    notFound();
  }
  if ((await getGuestListPermission(admin, eventId)).level !== "organizer") {
    redirect(`/admin/events/${eventId}`);
  }
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      coupleNames: true,
      eventSubtitle: true,
      eventDate: true,
      rsvpDeadline: true,
      eventTime: true,
      venue: true,
      description: true,
      welcomeMessage: true,
      inviteMessageIntro: true,
      inviteMessageLineOverride: true,
      inviteFontStyle: true,
      imagePath: true,
      genericCardImage: true,
      cardImage1: true,
      cardImage2: true,
      cardImage3: true,
      cardImage4: true,
      familyCardImage: true,
      itinerary: true,
    },
  });
  if (!event) {
    notFound();
  }
  const safeImageSrc = getSafeImageSrc(event.imagePath);
  console.info("[event-image] admin edit render src", {
    eventId: event.id,
    rawImagePath: event.imagePath,
    safeImageSrc,
  });

  const itineraryItems: ItineraryItem[] = Array.isArray(event.itinerary)
    ? (event.itinerary as ItineraryItem[]).filter(
        (x) =>
          x &&
          typeof x.title === "string" &&
          (typeof x.startTime === "string" || typeof x.time === "string"),
      )
    : [];

  return (
    <main className="app-shell max-w-4xl">

      <PageHeader
        title="Edit event"
        back={{ href: `/admin/events/${event.id}`, label: event.title }}
        actions={<RsvpPreviewModal eventId={event.id} formId="event-edit-form" />}
      />

      <form id="event-edit-form" action={updateEventAction} className="max-w-4xl">
        <input type="hidden" name="eventId" value={event.id} />

        {/* ── 1. Identity ── */}
        <FormSection title="Names" description="Shown at the top of the invitation.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="form-label">
                Event title <Required />
              </label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={event.title}
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
                defaultValue={event.coupleNames ?? ""}
                className="input-luxe mt-0"
              />
              <p className="field-hint">The large heading on the invitation.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eventSubtitle" className="form-label">
                Subtitle <Optional />
              </label>
              <input
                id="eventSubtitle"
                name="eventSubtitle"
                type="text"
                defaultValue={event.eventSubtitle ?? ""}
                className="input-luxe mt-0"
              />
            </div>
          </div>
        </FormSection>

        {/* ── 2. Schedule ── */}
        <FormSection id="schedule" title="Date and replies" description="When it happens and when replies close.">
          <div className="grid gap-4 sm:grid-cols-2">
            <EventSchedulingFields
              eventDateDefault={event.eventDate ? event.eventDate.toISOString().slice(0, 10) : ""}
              rsvpDeadlineDefault={event.rsvpDeadline ? event.rsvpDeadline.toISOString().slice(0, 10) : ""}
              eventTimeDefault={event.eventTime ?? ""}
            />
          </div>
        </FormSection>

        {/* ── 3. Typography ── */}
        <EventFontStyleField defaultValue={event.inviteFontStyle} />

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
                defaultValue={event.venue ?? ""}
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
                defaultValue={event.welcomeMessage ?? ""}
                className="input-luxe mt-0 h-24 resize-none"
              />
            </div>
            <div>
              <label htmlFor="description" className="form-label">
                Description <Optional />
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={event.description ?? ""}
                className="input-luxe mt-0 h-24 resize-none"
              />
            </div>
            <div className="border-t border-[var(--border-soft)] pt-4">
              <p className="form-label mb-3">Message wording for WhatsApp and texts <Optional /></p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="inviteMessageIntro" className="mb-1.5 block text-xs text-[var(--muted-text)]">
                    Intro line
                  </label>
                  <input
                    id="inviteMessageIntro"
                    name="inviteMessageIntro"
                    type="text"
                    defaultValue={event.inviteMessageIntro ?? ""}
                    className="input-luxe mt-0"
                    placeholder="You are cordially invited to Aisha &amp; Omar's Nikkah Ceremony"
                  />
                </div>
                <div>
                  <label htmlFor="inviteMessageLineOverride" className="mb-1.5 block text-xs text-[var(--muted-text)]">
                    Second line
                  </label>
                  <input
                    id="inviteMessageLineOverride"
                    name="inviteMessageLineOverride"
                    type="text"
                    defaultValue={event.inviteMessageLineOverride ?? ""}
                    className="input-luxe mt-0"
                    placeholder="Your presence would truly make this event special."
                  />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── 5. Invitation card ── */}
        <FormSection title="Invitation card" description="The image guests see first.">
          <div className="space-y-4">
            {safeImageSrc ? (
              <div className="overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]">
                <div className="relative h-52 w-full overflow-hidden">
                  <SafeEventImage
                    src={safeImageSrc}
                    alt={event.title}
                    fill
                    className="object-contain object-center"
                    fallbackLabel="Invitation image unavailable"
                  />
                </div>
                <p className="border-t border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--muted-text)]">
                  Current card. Upload a new file to replace it.
                </p>
              </div>
            ) : null}
            <EventImageUploadField initialImagePath={event.imagePath} />
          </div>
        </FormSection>

        {/* ── 6. Itinerary ── */}
        <FormSection id="running-order" title="Running order" description="Timings for the day. Private items stay hidden from guests.">
          <EventItineraryFields initialItems={itineraryItems} />
        </FormSection>

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0 lg:bottom-0">
          <Link href={`/admin/events/${event.id}`} className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}

