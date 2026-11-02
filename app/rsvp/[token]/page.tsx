import { RsvpForm } from "@/components/rsvp-form";
import { InvitationDetails, InvitationSheet, inviteSerif } from "@/components/invitation/invitation-parts";
import { RsvpResponsePanel } from "@/components/rsvp-response-panel";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import { CountdownTimer } from "@/components/countdown-timer";
import { VenueMapButton } from "@/components/venue-map-button";
import { ScrollReveal } from "@/components/scroll-reveal";
import { CalendarModal } from "@/components/calendar-modal";
import { guestVisibleItinerary, ItineraryTimeline } from "@/components/itinerary-timeline";
import type { ItineraryItem } from "@/components/itinerary-timeline";
import type { Metadata } from "next";
import Link from "next/link";
import { getOptionalAdminUser } from "@/lib/admin-auth";
import { canActorAccessEvent } from "@/lib/wedding-access";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { buildRsvpOgRouteUrl, resolveRsvpPreviewCardSource } from "@/lib/rsvp-share-preview";
import { formatDateTime, getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GuestWithEventForRsvpPage = {
  id: string;
  guestName: string;
  maxGuests: number;
  menCount: number | null;
  womenCount: number | null;
  kidsCount: number | null;
  token: string;
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: Date | null;
  isFamilyInvite: boolean;
  event: {
    id: string;
    ownerUserId: string | null;
    title: string;
    description: string | null;
    imagePath: string | null;
    genericCardImage: string | null;
    cardImage1: string | null;
    cardImage2: string | null;
    cardImage3: string | null;
    cardImage4: string | null;
    familyCardImage: string | null;
    coupleNames: string | null;
    eventSubtitle: string | null;
    eventDate: Date | null;
    eventTime: string | null;
    venue: string | null;
    welcomeMessage: string | null;
    itinerary: unknown;
    inviteFontStyle: string | null;
    rsvpDeadline: Date | null;
  };
  hostMessage?: string | null;
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const guest = (await prisma.guest.findFirst({
    where: { token, deletedAt: null, event: { deletedAt: null } },
    select: {
      guestName: true,
      maxGuests: true,
      menCount: true,
      womenCount: true,
      kidsCount: true,
      isFamilyInvite: true,
      event: {
        select: {
          id: true,
          title: true,
          coupleNames: true,
          imagePath: true,
          genericCardImage: true,
          cardImage1: true,
          cardImage2: true,
          cardImage3: true,
          cardImage4: true,
          familyCardImage: true,
          updatedAt: true,
        },
      },
    },
  } as unknown as Parameters<typeof prisma.guest.findFirst>[0])) as unknown as null | {
    guestName: string;
    maxGuests: number;
    menCount: number | null;
    womenCount: number | null;
    kidsCount: number | null;
    isFamilyInvite: boolean;
    event: {
      id: string;
      title: string;
      coupleNames: string | null;
      imagePath: string | null;
      genericCardImage: string | null;
      cardImage1: string | null;
      cardImage2: string | null;
      cardImage3: string | null;
      cardImage4: string | null;
      familyCardImage: string | null;
      updatedAt: Date;
    };
  };
  if (!guest) {
    return {
      title: "Invitation RSVP",
      description: "Private RSVP invitation link.",
    };
  }

  const previewSource = resolveRsvpPreviewCardSource(
    {
      imagePath: guest.event.imagePath,
      genericCardImage: guest.event.genericCardImage,
      cardImage1: guest.event.cardImage1,
      cardImage2: guest.event.cardImage2,
      cardImage3: guest.event.cardImage3,
      cardImage4: guest.event.cardImage4,
      familyCardImage: guest.event.familyCardImage,
    },
    { maxGuests: guest.maxGuests, isFamilyInvite: guest.isFamilyInvite },
  );
  const base = getPublicSiteUrl();
  const absoluteImage = buildRsvpOgRouteUrl(token, guest.event.updatedAt.getTime()) ?? undefined;
  const canonical = base ? `${base}/rsvp/${token}` : undefined;
  const names = guest.event.coupleNames?.trim() || guest.event.title;
  const title = `${names} · RSVP Invitation`;
  const description = `You are invited to ${guest.event.title}. Please RSVP through this private invitation link.`;

  console.info("[rsvp:metadata] og selection", {
    token,
    eventId: guest.event.id,
    baseResolved: Boolean(base),
    resolvedVariantSource: previewSource.resolvedVariantSource,
    resolvedVariantSrc: previewSource.resolvedVariantSrc,
    defaultMainSrc: previewSource.defaultMainSrc,
    genericFallbackSrc: previewSource.genericFallbackSrc,
    chosenImage: absoluteImage ?? null,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(canonical ? { url: canonical } : {}),
      images: absoluteImage ? [{ url: absoluteImage, alt: `${guest.event.title} invitation card` }] : undefined,
    },
    alternates: canonical ? { canonical } : undefined,
    twitter: {
      card: absoluteImage ? "summary_large_image" : "summary",
      title,
      description,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  };
}

function buildCalendarPayload(input: {
  eventTitle: string;
  eventSubtitle: string | null;
  description: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  venue: string | null;
}) {
  if (!input.eventDate) return null;
  const [hStr, mStr] = (input.eventTime ?? "18:00").split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  const start = new Date(input.eventDate);
  if (Number.isFinite(hour)) start.setHours(hour);
  if (Number.isFinite(minute)) start.setMinutes(minute);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const toGCal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const summary = input.eventSubtitle?.trim() || input.eventTitle;
  const details = [input.description?.trim(), input.venue ? `Venue: ${input.venue}` : ""].filter(Boolean).join("\n");
  const googleUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(summary)}` +
    `&dates=${toGCal(start)}/${toGCal(end)}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(input.venue ?? "")}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RSVP App//EN",
    "BEGIN:VEVENT",
    `UID:rsvp-${start.getTime()}@rsvpapp`,
    `DTSTAMP:${toGCal(new Date())}`,
    `DTSTART:${toGCal(start)}`,
    `DTEND:${toGCal(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
    `LOCATION:${(input.venue ?? "").replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  return { googleUrl, icsDataUrl };
}


export default async function RsvpTokenPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const previewParam = sp.preview;
  const previewRequested =
    previewParam === "1" ||
    previewParam === "true" ||
    (Array.isArray(previewParam) && previewParam[0] === "1");

  const guest = (await prisma.guest.findFirst({
    where: { token, deletedAt: null, event: { deletedAt: null } },
    include: {
      event: {
        select: {
          id: true,
          ownerUserId: true,
          title: true,
          description: true,
          imagePath: true,
          genericCardImage: true,
          cardImage1: true,
          cardImage2: true,
          cardImage3: true,
          cardImage4: true,
          familyCardImage: true,
          coupleNames: true,
          eventSubtitle: true,
          eventDate: true,
          eventTime: true,
          venue: true,
          welcomeMessage: true,
          itinerary: true,
          inviteFontStyle: true,
          rsvpDeadline: true,
        },
      },
    },
  } as unknown as Parameters<typeof prisma.guest.findFirst>[0])) as unknown as GuestWithEventForRsvpPage | null;

  if (!guest) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="invite-sheet w-full max-w-md px-8 py-10 text-center">
          <div className="invite-rule" aria-hidden />
          <h1 className={`mt-6 text-3xl leading-tight text-[var(--inv-ink)] ${inviteSerif}`}>We couldn&apos;t find this invitation</h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--inv-muted)]">
            The link may be incomplete or no longer active. Please ask your hosts to send it again.
          </p>
        </div>
      </main>
    );
  }

  const admin = previewRequested ? await getOptionalAdminUser() : null;
  const ev = guest.event;
  const previewMode =
    Boolean(previewRequested) &&
    admin !== null &&
    (await canActorAccessEvent(admin, ev.id));

  const hasResponded = Boolean(guest.respondedAt);
  const resolvedCard = resolveInviteCardImage(
    {
      imagePath: ev.imagePath,
      genericCardImage: ev.genericCardImage,
      cardImage1: ev.cardImage1,
      cardImage2: ev.cardImage2,
      cardImage3: ev.cardImage3,
      cardImage4: ev.cardImage4,
      familyCardImage: ev.familyCardImage,
    },
    { maxGuests: guest.maxGuests, isFamilyInvite: guest.isFamilyInvite },
  );
  const safeImageSrc = getSafeImageSrc(resolvedCard.rawPath);
  const deadlineMeta = getRsvpDeadlineMeta(ev.rsvpDeadline);
  const isRsvpClosed = deadlineMeta?.status === "closed";

  const displayNames = ev.coupleNames?.trim() || ev.title;
  const hasCoupleNames = Boolean(ev.coupleNames?.trim());
  const inviteCapacity = (guest.menCount ?? 0) + (guest.womenCount ?? 0) + (guest.kidsCount ?? 0) || guest.maxGuests;
  const calendarPayload = buildCalendarPayload({
    eventTitle: ev.title,
    eventSubtitle: ev.eventSubtitle,
    description: ev.description,
    eventDate: ev.eventDate,
    eventTime: ev.eventTime,
    venue: ev.venue,
  });

  // "YYYY-MM-DDTHH:MM:SS" with NO timezone suffix so the client parses it as
  // local time — guests in the event's timezone see the correct countdown target.
  const eventStartISO: string | null = ev.eventDate
    ? (() => {
        const d = ev.eventDate;
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const time = ev.eventTime?.trim() ?? "00:00";
        return `${yyyy}-${mm}-${dd}T${time}:00`;
      })()
    : null;

  const itinerary: ItineraryItem[] = guestVisibleItinerary(
    Array.isArray(ev.itinerary)
      ? (ev.itinerary as ItineraryItem[]).filter(
          (x) =>
            x &&
            typeof x.title === "string" &&
            (typeof x.startTime === "string" || typeof x.time === "string"),
        )
      : [],
  );

  const invitationContent = (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      {previewMode ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-[#ead8b0] bg-[#f7eedb]/95 px-4 py-2.5 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-[#5f3d00]">
            Previewing as <span className="font-semibold">{guest.guestName}</span>. Replies are turned off.
            <span className="mx-2 opacity-60">·</span>
            <Link href={`/admin/events/${ev.id}`} className="font-semibold underline underline-offset-2">
              Back to event
            </Link>
          </p>
        </div>
      ) : null}

      <div className={`mx-auto w-full max-w-xl space-y-4 ${previewMode ? "pt-14" : ""}`}>
        <ScrollReveal>
          <InvitationSheet
            imageSrc={safeImageSrc}
            imageAlt={ev.title}
            names={displayNames}
            eventTitle={hasCoupleNames ? ev.title : null}
            subtitle={ev.eventSubtitle}
            fontStyle={ev.inviteFontStyle}
            greeting={`Dear ${guest.guestName.replace(/^the\s+/i, "")},`}
          >
            {hasResponded && guest.attending === false ? (
              <p>We&apos;ll miss you, and we completely understand.</p>
            ) : !ev.welcomeMessage ? (
              <p>We would be honored to celebrate with you.</p>
            ) : null}
            {ev.welcomeMessage ? <p className="whitespace-pre-line">{ev.welcomeMessage}</p> : null}
            {hasResponded && guest.attending === false ? null : (
              <p>
                This invitation is for up to <span className="font-semibold text-[var(--inv-ink)]">{inviteCapacity}</span>{" "}
                {inviteCapacity === 1 ? "person" : "people"}.
              </p>
            )}
            {ev.description ? <p className="text-sm text-[var(--inv-muted)] whitespace-pre-line">{ev.description}</p> : null}
          </InvitationSheet>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <InvitationDetails
            eventDate={ev.eventDate}
            eventTime={ev.eventTime}
            venue={ev.venue}
            replyBy={ev.rsvpDeadline}
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
            {isRsvpClosed && !hasResponded ? (
              <div className="invite-sheet w-full px-6 py-9 text-center">
                <h2 className={`text-2xl text-[var(--inv-ink)] ${inviteSerif}`}>Replies have closed</h2>
                <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--inv-muted)]">
                  If you&apos;d still like to come, please contact your hosts directly.
                </p>
              </div>
            ) : hasResponded ? (
              <RsvpResponsePanel
                token={token}
                maxGuests={guest.maxGuests}
                respondedAtLabel={formatDateTime(guest.respondedAt)}
                attending={guest.attending}
                attendingCount={guest.attendingCount}
                hostMessage={(guest as unknown as { hostMessage?: string | null }).hostMessage ?? null}
                canEdit={!isRsvpClosed}
                previewMode={previewMode}
              />
            ) : (
              <RsvpForm
                token={token}
                maxGuests={guest.maxGuests}
                isLocked={hasResponded}
                previewMode={previewMode}
              />
            )}
          </section>
        </ScrollReveal>

        {/* ── 6. Itinerary ── */}
        {itinerary.length > 0 ? (
          <ScrollReveal delay={40}>
            <ItineraryTimeline items={itinerary} />
          </ScrollReveal>
        ) : null}

        {/* ── 7. Map (attending guests only) ── */}
        {ev.venue && hasResponded && guest.attending === true ? (
          <ScrollReveal delay={40}>
            <VenueMapButton venue={ev.venue} />
          </ScrollReveal>
        ) : null}

        {/* ── 8. Calendar (attending guests only) ── */}
        {calendarPayload && hasResponded && guest.attending === true ? (
          <ScrollReveal delay={60}>
            <div className="pb-2 text-center">
              <CalendarModal icsDataUrl={calendarPayload.icsDataUrl} googleUrl={calendarPayload.googleUrl} />
            </div>
          </ScrollReveal>
        ) : null}

      </div>
    </main>
  );

  return (
    <EnvelopeReveal skip={previewMode || hasResponded} guestName={guest.guestName}>
      {invitationContent}
    </EnvelopeReveal>
  );
}
