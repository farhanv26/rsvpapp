"use client";

import { CountdownTimer } from "@/components/countdown-timer";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import { InvitationDetails, InvitationSheet } from "@/components/invitation/invitation-parts";
import { guestVisibleItinerary, ItineraryTimeline } from "@/components/itinerary-timeline";
import type { ItineraryItem } from "@/components/itinerary-timeline";
import { RsvpForm } from "@/components/rsvp-form";
import { ScrollReveal } from "@/components/scroll-reveal";
import { VenueMapButton } from "@/components/venue-map-button";
import { CalendarModal } from "@/components/calendar-modal";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";

export type LivePreviewData = {
  title: string;
  coupleNames: string;
  eventSubtitle: string;
  eventDate: Date | null;
  eventTime: string;
  venue: string;
  welcomeMessage: string;
  description: string;
  inviteFontStyle: string;
  rsvpDeadline: Date | null;
  itinerary: ItineraryItem[];
  imagePath: string;
  genericCardImage: string;
  cardImage1: string;
  cardImage2: string;
  cardImage3: string;
  cardImage4: string;
  familyCardImage: string;
};

function buildCalendarPayload(ev: LivePreviewData) {
  if (!ev.eventDate) return null;
  const [hStr, mStr] = (ev.eventTime || "18:00").split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  const start = new Date(ev.eventDate);
  if (Number.isFinite(hour)) start.setHours(hour);
  if (Number.isFinite(minute)) start.setMinutes(minute);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const toGCal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const summary = ev.eventSubtitle?.trim() || ev.title;
  const details = [ev.description?.trim(), ev.venue ? `Venue: ${ev.venue}` : ""].filter(Boolean).join("\n");
  const googleUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(summary)}` +
    `&dates=${toGCal(start)}/${toGCal(end)}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(ev.venue ?? "")}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RSVP App//EN",
    "BEGIN:VEVENT",
    `UID:rsvp-${start.getTime()}@rsvpapp`,
    `DTSTAMP:${toGCal(new Date())}`,
    `DTSTART:${toGCal(start)}`, `DTEND:${toGCal(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
    `LOCATION:${(ev.venue ?? "").replace(/\n/g, " ")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return { googleUrl, icsDataUrl: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

/** What a guest sees, rendered from event data with a sample household ("Your Guest", 2 places). */
export function RsvpPreviewContent({ data }: { data: LivePreviewData }) {
  const resolvedCard = resolveInviteCardImage(
    {
      imagePath: data.imagePath || null,
      genericCardImage: data.genericCardImage || null,
      cardImage1: data.cardImage1 || null,
      cardImage2: data.cardImage2 || null,
      cardImage3: data.cardImage3 || null,
      cardImage4: data.cardImage4 || null,
      familyCardImage: data.familyCardImage || null,
    },
    { maxGuests: 2, isFamilyInvite: false },
  );
  const safeImageSrc = getSafeImageSrc(resolvedCard.rawPath);
  const deadlineMeta = getRsvpDeadlineMeta(data.rsvpDeadline);
  const displayNames = data.coupleNames?.trim() || data.title;
  const hasCoupleNames = Boolean(data.coupleNames?.trim());
  const itinerary = guestVisibleItinerary(data.itinerary);

  const eventStartISO: string | null = data.eventDate
    ? (() => {
        const d = data.eventDate!;
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T${data.eventTime?.trim() || "00:00"}:00`;
      })()
    : null;

  const calendarPayload = buildCalendarPayload(data);
  const afterYes = <p className="invite-label mb-1.5 text-center">Shown after a guest says yes</p>;

  const content = (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <ScrollReveal>
          <InvitationSheet
            imageSrc={safeImageSrc}
            imageAlt={data.title}
            names={displayNames}
            eventTitle={hasCoupleNames ? data.title : null}
            subtitle={data.eventSubtitle || null}
            fontStyle={data.inviteFontStyle}
            greeting="Dear Your Guest,"
          >
            {data.welcomeMessage ? <p className="whitespace-pre-line">{data.welcomeMessage}</p> : <p>We would be honored to celebrate with you.</p>}
            <p>
              Your invitation includes up to <span className="font-semibold text-[var(--inv-ink)]">2</span> guests.
            </p>
            {data.description ? <p className="text-sm whitespace-pre-line text-[var(--inv-muted)]">{data.description}</p> : null}
          </InvitationSheet>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <InvitationDetails
            eventDate={data.eventDate}
            eventTime={data.eventTime || null}
            venue={data.venue || null}
            replyBy={data.rsvpDeadline}
            replyUrgent={deadlineMeta?.status === "closes_today" || (deadlineMeta?.status === "closing_soon" && deadlineMeta.daysRemaining <= 3)}
            replyNote={
              deadlineMeta?.status === "closed"
                ? "Replies have closed"
                : deadlineMeta?.status === "closes_today"
                  ? "Last day to reply"
                  : deadlineMeta?.status === "closing_soon"
                    ? `${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"} left to reply`
                    : null
            }
          />
        </ScrollReveal>

        {eventStartISO ? (
          <ScrollReveal delay={40}>
            <CountdownTimer eventStartISO={eventStartISO} />
          </ScrollReveal>
        ) : null}

        <ScrollReveal delay={60}>
          <section>
            <RsvpForm token="preview" maxGuests={2} isLocked={false} previewMode={true} />
          </section>
        </ScrollReveal>

        {itinerary.length > 0 ? (
          <ScrollReveal delay={40}>
            <ItineraryTimeline items={itinerary} />
          </ScrollReveal>
        ) : null}

        {data.venue ? (
          <ScrollReveal delay={40}>
            <div>
              {afterYes}
              <VenueMapButton venue={data.venue} />
            </div>
          </ScrollReveal>
        ) : null}

        {calendarPayload ? (
          <ScrollReveal delay={60}>
            <div className="pb-2 text-center">
              {afterYes}
              <CalendarModal icsDataUrl={calendarPayload.icsDataUrl} googleUrl={calendarPayload.googleUrl} />
            </div>
          </ScrollReveal>
        ) : null}
      </div>
    </main>
  );

  return (
    <div className="invite">
      <EnvelopeReveal guestName="Your Guest">{content}</EnvelopeReveal>
    </div>
  );
}
