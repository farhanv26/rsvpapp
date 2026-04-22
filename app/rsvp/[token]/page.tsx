import { RsvpForm } from "@/components/rsvp-form";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { RsvpResponsePanel } from "@/components/rsvp-response-panel";
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

function CeremonyDetails({
  eventTitle,
  eventSubtitle,
  description,
  eventDate,
  eventTime,
  venue,
  showCalendarActions,
}: {
  eventTitle: string;
  eventSubtitle: string | null;
  description: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  venue: string | null;
  showCalendarActions: boolean;
}) {
  const dateLine = eventDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(eventDate) : null;
  const displayTime = formatEventTime(eventTime);
  const calendarPayload = buildCalendarPayload({ eventTitle, eventSubtitle, description, eventDate, eventTime, venue });

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-5 py-5">
      <div className="space-y-3 text-left">
        {dateLine ? (
          <DetailLine label="Date" value={dateLine} icon="calendar" />
        ) : null}
        {displayTime ? (
          <DetailLine label="Time" value={displayTime} icon="clock" />
        ) : null}
        {venue ? (
          <DetailLine label="Venue" value={venue} icon="pin" />
        ) : null}
        {showCalendarActions && calendarPayload ? (
          <div className="pt-2 text-center">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Add to calendar</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a
                href={calendarPayload.googleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dadde3] bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-[#c7ccd6] hover:bg-[#f8fafc]"
              >
                <GoogleCalendarLogo />
                <span>Google</span>
              </a>
              <a
                href={calendarPayload.icsDataUrl}
                download="event-invitation-apple.ics"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dadde3] bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-[#c7ccd6] hover:bg-[#f8fafc]"
              >
                <AppleCalendarLogo />
                <span>Apple</span>
              </a>
              <a
                href={calendarPayload.icsDataUrl}
                download="event-invitation-outlook.ics"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dadde3] bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-[#c7ccd6] hover:bg-[#f8fafc]"
              >
                <OutlookLogo />
                <span>Outlook (.ics)</span>
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#dadce0" />
      <rect x="3" y="4" width="18" height="5" rx="3" fill="#34A853" />
      <rect x="8.8" y="11" width="6.4" height="6.2" rx="1.1" fill="#4285F4" />
      <path d="M12 12.5v3M10.6 14h2.8" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function AppleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#d1d5db" />
      <rect x="3" y="4" width="18" height="5" rx="3" fill="#ef4444" />
      <text x="12" y="17" textAnchor="middle" fontSize="7" fontWeight="700" fill="#111827">
        12
      </text>
    </svg>
  );
}

function OutlookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" fill="#2563eb" />
      <rect x="4.8" y="7" width="7.2" height="10" rx="1.2" fill="#1d4ed8" />
      <circle cx="8.4" cy="12" r="2.1" fill="#fff" />
      <path d="M12.8 9.2h6.2M12.8 12h6.2M12.8 14.8h6.2" stroke="#dbeafe" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
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

function DetailLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: "calendar" | "clock" | "pin";
}) {
  const iconNode =
    icon === "calendar" ? (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#8b6a34]">
        <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 8.5h14M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ) : icon === "clock" ? (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#8b6a34]">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 6.8v3.6l2.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#8b6a34]">
        <path d="M10 17s5-4.8 5-8.4A5 5 0 0 0 5 8.6C5 12.2 10 17 10 17Z" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10" cy="8.4" r="1.8" fill="currentColor" />
      </svg>
    );

  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/65 px-3 py-2.5">
      <span className="mt-0.5">{iconNode}</span>
      <div>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
        <p className="mt-1 text-sm leading-snug text-zinc-800">{value}</p>
      </div>
    </div>
  );
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
  const hasCeremonyDetails = Boolean(ev.eventDate || ev.eventTime || ev.venue);
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

  return (
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
      <div
        className={`mx-auto w-full max-w-xl space-y-8 ${previewMode ? "pt-[4.5rem]" : ""}`}
      >
        <section className={`rsvp-fade-up rounded-3xl border p-5 sm:p-7 ${panelClass}`}>
          <div className="space-y-6 text-center">
            {safeImageSrc ? (
              <div className="mx-auto w-full max-w-[31rem]">
                <EventImageLightbox
                  src={safeImageSrc}
                  alt={ev.title}
                  hintText="Tap to enlarge invitation"
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <h1 className={`mt-1 leading-[1.15] text-zinc-900 ${headingClass}`}>
                {displayNames}
              </h1>
              {hasCoupleNames ? <p className={`mt-2 text-lg text-zinc-600 ${serif}`}>{ev.title}</p> : null}
              {ev.eventSubtitle ? <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">{ev.eventSubtitle}</p> : null}
            </div>

            {hasCeremonyDetails ? (
              <CeremonyDetails
                eventTitle={ev.title}
                eventSubtitle={ev.eventSubtitle}
                description={ev.description}
                eventDate={ev.eventDate}
                eventTime={ev.eventTime}
                venue={ev.venue}
                showCalendarActions={hasResponded && guest.attending === true}
              />
            ) : null}
            {ev.rsvpDeadline ? (
              <div className="space-y-2">
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
                      : deadlineMeta.daysRemaining <= 3
                        ? `RSVP closes soon · ${deadlineMeta.daysRemaining} day${
                            deadlineMeta.daysRemaining === 1 ? "" : "s"
                          } left`
                        : `Please respond by ${new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                          }).format(ev.rsvpDeadline)}`}
                  </p>
                ) : null}
              </div>
            ) : null}

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
              {ev.welcomeMessage ? <p className="mt-3 text-sm leading-relaxed text-zinc-700">{ev.welcomeMessage}</p> : null}
              {ev.description ? <p className="mt-3 text-sm leading-relaxed text-zinc-600">{ev.description}</p> : null}
            </div>
          </div>
        </section>

        <section className="rsvp-fade-up [animation-delay:90ms]">
          {isRsvpClosed && !hasResponded ? (
            <div className="w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-6 py-9 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">RSVP closed</p>
              <h2 className="mt-3 text-3xl font-semibold text-zinc-900">RSVP is now closed.</h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
                We can no longer accept responses for this invitation.
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
      </div>
    </main>
  );
}
