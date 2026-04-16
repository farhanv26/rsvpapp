import { RsvpForm } from "@/components/rsvp-form";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { RsvpResponsePanel } from "@/components/rsvp-response-panel";
import type { Metadata } from "next";
import Link from "next/link";
import { getOptionalAdminUser, isSuperAdmin } from "@/lib/admin-auth";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { formatDateTime, getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const script = "font-[family-name:var(--font-wedding-script),cursive]";
const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const guest = await prisma.guest.findUnique({
    where: { token },
    select: {
      guestName: true,
      maxGuests: true,
      isFamilyInvite: true,
      event: {
        select: {
          title: true,
          coupleNames: true,
          imagePath: true,
          genericCardImage: true,
          cardImage1: true,
          cardImage2: true,
          cardImage3: true,
          cardImage4: true,
          familyCardImage: true,
        },
      },
    },
  });
  if (!guest) {
    return {
      title: "Invitation RSVP",
      description: "Private RSVP invitation link.",
    };
  }

  const resolvedCard = resolveInviteCardImage(
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
  const safeImageSrc = getSafeImageSrc(resolvedCard.rawPath);
  const base = getPublicSiteUrl();
  const absoluteImage =
    safeImageSrc && base && safeImageSrc.startsWith("/") ? `${base}${safeImageSrc}` : safeImageSrc ?? undefined;
  const names = guest.event.coupleNames?.trim() || guest.event.title;
  const title = `${names} · RSVP Invitation`;
  const description = `You are invited to ${guest.event.title}. Please RSVP through this private invitation link.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: absoluteImage ? [{ url: absoluteImage, alt: `${guest.event.title} invitation card` }] : undefined,
    },
    twitter: {
      card: absoluteImage ? "summary_large_image" : "summary",
      title,
      description,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  };
}

function CeremonyDetails({
  eventDate,
  eventTime,
  venue,
}: {
  eventDate: Date | null;
  eventTime: string | null;
  venue: string | null;
}) {
  const dateLine = eventDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(eventDate) : null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-5 py-5">
      <div className="space-y-3 text-left">
        {dateLine ? (
          <DetailLine label="Date" value={dateLine} icon="calendar" />
        ) : null}
        {eventTime ? (
          <DetailLine label="Time" value={eventTime} icon="clock" />
        ) : null}
        {venue ? (
          <DetailLine label="Venue" value={venue} icon="pin" />
        ) : null}
      </div>
    </div>
  );
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

  const guest = await prisma.guest.findUnique({
    where: { token },
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
          rsvpDeadline: true,
        },
      },
    },
  });

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
  const showScriptNames = Boolean(ev.coupleNames?.trim());
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
                  previewHeightClassName="h-[25rem] sm:h-[36rem]"
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Wedding invitation</p>
              <h1 className={`mt-3 leading-[1.15] text-zinc-900 ${showScriptNames ? `${script} text-[2.6rem] sm:text-[3rem]` : `${serif} text-4xl`}`}>
                {displayNames}
              </h1>
              {showScriptNames ? <p className={`mt-2 text-lg text-zinc-600 ${serif}`}>{ev.title}</p> : null}
              {ev.eventSubtitle ? <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">{ev.eventSubtitle}</p> : null}
            </div>

            {hasCeremonyDetails ? (
              <CeremonyDetails eventDate={ev.eventDate} eventTime={ev.eventTime} venue={ev.venue} />
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
              <p className={`text-2xl text-zinc-900 ${script}`}>Dear {guest.guestName},</p>
              <p className="mt-3 text-base leading-relaxed text-zinc-700">
                {hasResponded && guest.attending === false ? (
                  "We are sorry you will not be able to attend, but we completely understand."
                ) : (
                  <>
                    <span className="block">We would be honored to celebrate with you.</span>
                    <span className="mt-2 block">
                      Your invitation includes up to{" "}
                      <span className="font-semibold text-zinc-900">{guest.maxGuests}</span>{" "}
                      {guest.maxGuests === 1 ? "guest" : "guests"}.
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
