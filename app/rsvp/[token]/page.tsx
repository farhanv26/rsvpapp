import { RsvpForm } from "@/components/rsvp-form";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { RsvpResponsePanel } from "@/components/rsvp-response-panel";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import { CountdownTimer } from "@/components/countdown-timer";
import { VenueMapButton } from "@/components/venue-map-button";
import { ScrollReveal } from "@/components/scroll-reveal";
import { CalendarModal } from "@/components/calendar-modal";
import { ItineraryTimeline } from "@/components/itinerary-timeline";
import type { ItineraryItem } from "@/components/itinerary-timeline";
import type { Metadata } from "next";
import Link from "next/link";
import { getOptionalAdminUser, isSuperAdmin } from "@/lib/admin-auth";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { buildRsvpOgRouteUrl, resolveRsvpPreviewCardSource } from "@/lib/rsvp-share-preview";
import { formatDateTime, getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const script = "font-[family-name:var(--font-wedding-script),cursive]";
const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

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

function DateCard({ eventDate }: { eventDate: Date }) {
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(eventDate);
  const fullDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(eventDate);
  return (
    <div className={`flex h-full flex-col justify-center overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-5 text-center ${serif}`}>
      <div className="mb-3 h-0.5 bg-gradient-to-r from-transparent via-[#b28944]/40 to-transparent" aria-hidden />
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-zinc-400">Date</p>
      <p className="mt-2 text-xl leading-tight text-zinc-900">{dayName}</p>
      <p className="mt-1 text-sm leading-snug text-zinc-500">{fullDate}</p>
    </div>
  );
}

function TimeCard({ eventTime }: { eventTime: string }) {
  const display = formatEventTime(eventTime);
  return (
    <div className={`flex h-full flex-col justify-center overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-5 text-center ${serif}`}>
      <div className="mb-3 h-0.5 bg-gradient-to-r from-transparent via-[#b28944]/40 to-transparent" aria-hidden />
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-zinc-400">Time</p>
      <p className="mt-2 text-xl leading-tight text-zinc-900">{display ?? eventTime}</p>
    </div>
  );
}

function formatEventTime(raw: string | null) {
  if (!raw) return null;
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h24 = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h24) || !Number.isFinite(min)) return t;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
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
        <div className="w-full max-w-md rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-8 py-10 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Invitation</p>
          <h1 className={`mt-3 text-3xl leading-tight text-zinc-900 ${serif}`}>This RSVP link could not be opened</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">
            The link may be incorrect or is no longer active. Please contact Farhan &amp; Rafiya or your hosts for a new
            RSVP link.
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
    (isSuperAdmin(admin) || ev.ownerUserId === admin.id);

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
  console.info("[event-image] rsvp render src", {
    token,
    rawImagePath: resolvedCard.rawPath,
    variant: resolvedCard.variantLabel,
    safeImageSrc,
  });
  const deadlineMeta = getRsvpDeadlineMeta(ev.rsvpDeadline);
  const isRsvpClosed = deadlineMeta?.status === "closed";

  const displayNames = ev.coupleNames?.trim() || ev.title;
  const hasCoupleNames = Boolean(ev.coupleNames?.trim());
  const inviteCapacity = (guest.menCount ?? 0) + (guest.womenCount ?? 0) + (guest.kidsCount ?? 0) || guest.maxGuests;
  const headingClass =
    ev.inviteFontStyle === "romantic_script"
      ? `${script} text-[2.6rem] sm:text-[3rem]`
      : ev.inviteFontStyle === "soft_script"
        ? "text-[2.5rem] sm:text-[2.9rem] [font-family:var(--font-wedding-script-alt),cursive]"
      : ev.inviteFontStyle === "modern_clean"
        ? "font-sans text-4xl tracking-wide"
        : ev.inviteFontStyle === "classic_formal"
          ? "font-serif text-4xl uppercase tracking-[0.14em]"
          : `${serif} text-4xl`;
  const salutationClass =
    ev.inviteFontStyle === "romantic_script"
      ? `${script} text-2xl sm:text-[2rem]`
      : ev.inviteFontStyle === "soft_script"
        ? "text-[2rem] sm:text-[2.15rem] [font-family:var(--font-wedding-script-alt),cursive]"
        : ev.inviteFontStyle === "modern_clean"
          ? "font-sans text-2xl tracking-wide"
          : ev.inviteFontStyle === "classic_formal"
            ? "font-serif text-2xl uppercase tracking-[0.1em]"
            : `${serif} text-2xl`;
  const panelClass = "border-[#e7dccb] bg-[#fffdfa] shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]";
  const detailClass = "border-[#e7dccb] bg-[#fbf8f2]";

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

  const itinerary: ItineraryItem[] = Array.isArray(ev.itinerary)
    ? (ev.itinerary as ItineraryItem[]).filter(
        (x) => x && typeof x.time === "string" && typeof x.title === "string",
      )
    : [];

  const invitationContent = (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      {previewMode ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-200/90 bg-amber-50/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
          <p className="text-sm font-medium text-amber-950">
            Previewing RSVP as <span className="font-semibold">{guest.guestName}</span>
            <span className="mx-2 text-amber-800/80">·</span>
            <Link
              href={`/admin/events/${ev.id}`}
              className="font-medium text-amber-900 underline decoration-amber-700/50 underline-offset-2 hover:text-amber-950"
            >
              Back to event
            </Link>
          </p>
          <p className="mt-1 text-xs text-amber-900/85">
            This is an admin preview. RSVP actions are disabled so you don&apos;t change this guest&apos;s response by
            mistake.
          </p>
        </div>
      ) : null}

      <div className={`mx-auto w-full max-w-xl space-y-5 ${previewMode ? "pt-[4.5rem]" : ""}`}>

        {/* ── 1. Hero: image + names + dear guest ── */}
        <ScrollReveal>
          <section className={`rounded-3xl border p-5 sm:p-8 ${panelClass}`}>
            <div className="space-y-7 text-center">

              {safeImageSrc ? (
                <div className="mx-auto w-full max-w-[30rem]">
                  <EventImageLightbox src={safeImageSrc} alt={ev.title} hintText="Tap to enlarge invitation" />
                </div>
              ) : null}

              <div className="space-y-2">
                <h1 className={`leading-[1.15] text-zinc-900 ${headingClass}`}>{displayNames}</h1>
                {hasCoupleNames ? (
                  <p className={`text-base text-zinc-500 ${serif}`}>{ev.title}</p>
                ) : null}
                {ev.eventSubtitle ? (
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-500">{ev.eventSubtitle}</p>
                ) : null}
              </div>

              <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent" aria-hidden />

              <div className={`mx-auto max-w-md rounded-2xl border px-5 py-5 text-center ${detailClass}`}>
                <p className={`text-zinc-900 ${salutationClass}`}>Dear {guest.guestName},</p>
                <p className="mt-3 text-base leading-relaxed text-zinc-700">
                  {hasResponded && guest.attending === false ? (
                    "We are sorry you will not be able to attend, but we completely understand."
                  ) : (
                    <>
                      <span className="block">We would be honored to celebrate with you.</span>
                      <span className="mt-2 block">
                        Your invitation includes up to{" "}
                        <span className="font-semibold text-zinc-900">{inviteCapacity}</span>{" "}
                        {inviteCapacity === 1 ? "guest" : "guests"}.
                      </span>
                    </>
                  )}
                </p>
                {ev.welcomeMessage ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700">{ev.welcomeMessage}</p>
                ) : null}
                {ev.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">{ev.description}</p>
                ) : null}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── 2. Date + Time ── */}
        {(ev.eventDate || ev.eventTime) ? (
          <div className={ev.eventDate && ev.eventTime ? "grid grid-cols-2 items-stretch gap-3" : ""}>
            {ev.eventDate ? (
              <ScrollReveal delay={60} className="h-full">
                <DateCard eventDate={ev.eventDate} />
              </ScrollReveal>
            ) : null}
            {ev.eventTime ? (
              <ScrollReveal delay={100} className="h-full">
                <TimeCard eventTime={ev.eventTime} />
              </ScrollReveal>
            ) : null}
          </div>
        ) : null}

        {/* ── 3. Countdown (shows while event is in the future) ── */}
        {eventStartISO ? (
          <ScrollReveal delay={40}>
            <CountdownTimer eventStartISO={eventStartISO} />
          </ScrollReveal>
        ) : null}

        {/* ── 4. RSVP deadline notice ── */}
        {ev.rsvpDeadline ? (
          <ScrollReveal delay={40}>
            <div className="space-y-2 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                RSVP by{" "}
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(ev.rsvpDeadline)}
              </p>
              {deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today" ? (
                <p
                  className={`mx-auto w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    deadlineMeta.status === "closes_today"
                      ? "bg-rose-100 text-rose-800"
                      : deadlineMeta.daysRemaining <= 3
                        ? "bg-amber-100 text-amber-900"
                        : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {deadlineMeta.status === "closes_today"
                    ? "RSVP closes today"
                    : `RSVP closes soon · ${deadlineMeta.daysRemaining} day${
                        deadlineMeta.daysRemaining === 1 ? "" : "s"
                      } left`}
                </p>
              ) : null}
            </div>
          </ScrollReveal>
        ) : null}

        {/* ── 5. RSVP ── */}
        <ScrollReveal delay={60}>
          <section>
            {isRsvpClosed && !hasResponded ? (
              <div className="w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-6 py-9 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">RSVP closed</p>
                <h2 className={`mt-3 text-2xl text-zinc-900 ${serif}`}>Responses are now closed.</h2>
                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
                  This invitation is no longer accepting RSVP responses.
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
    <EnvelopeReveal
      skip={previewMode}
      guestName={guest.guestName}
    >
      {invitationContent}
    </EnvelopeReveal>
  );
}
