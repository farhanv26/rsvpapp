import { RsvpForm } from "@/components/rsvp-form";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { CountdownTimer } from "@/components/countdown-timer";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ItineraryTimeline } from "@/components/itinerary-timeline";
import type { ItineraryItem } from "@/components/itinerary-timeline";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalAdminUser, isSuperAdmin } from "@/lib/admin-auth";
import { readAdminSessionToken } from "@/lib/admin-session";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { formatDateTime, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const script = "font-[family-name:var(--font-wedding-script),cursive]";
const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function DateCard({ eventDate }: { eventDate: Date }) {
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(eventDate);
  const fullDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(eventDate);
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

export default async function RsvpPreviewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = searchParams ? await searchParams : {};

  // Auth: web session or mobile Bearer token passed as ?mt=
  let admin = await getOptionalAdminUser();

  if (!admin) {
    const mtParam = sp.mt;
    const mt = Array.isArray(mtParam) ? mtParam[0] : mtParam;
    if (mt) {
      try {
        const session = await readAdminSessionToken(mt);
        const row = await prisma.user.findFirst({
          where: { id: session.userId, deletedAt: null },
          select: { id: true, name: true, role: true, active: true },
        });
        if (row?.active) {
          admin = { id: row.id, name: row.name, role: row.role };
        }
      } catch {
        // invalid token — fall through to redirect
      }
    }
  }

  if (!admin) {
    redirect("/admin/login");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
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
  });

  if (!event) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-8 py-10 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
          <p className={`text-2xl text-zinc-900 ${serif}`}>Event not found</p>
        </div>
      </main>
    );
  }

  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    redirect("/admin/events");
  }

  const resolvedCard = resolveInviteCardImage(
    {
      imagePath: event.imagePath,
      genericCardImage: event.genericCardImage,
      cardImage1: event.cardImage1,
      cardImage2: event.cardImage2,
      cardImage3: event.cardImage3,
      cardImage4: event.cardImage4,
      familyCardImage: event.familyCardImage,
    },
    { maxGuests: 2, isFamilyInvite: false },
  );
  const safeImageSrc = getSafeImageSrc(resolvedCard.rawPath);
  const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);

  const displayNames = event.coupleNames?.trim() || event.title;
  const hasCoupleNames = Boolean(event.coupleNames?.trim());

  const headingClass =
    event.inviteFontStyle === "romantic_script"
      ? `${script} text-[2.6rem] sm:text-[3rem]`
      : event.inviteFontStyle === "soft_script"
        ? "text-[2.5rem] sm:text-[2.9rem] [font-family:var(--font-wedding-script-alt),cursive]"
        : event.inviteFontStyle === "modern_clean"
          ? "font-sans text-4xl tracking-wide"
          : event.inviteFontStyle === "classic_formal"
            ? "font-serif text-4xl uppercase tracking-[0.14em]"
            : `${serif} text-4xl`;
  const salutationClass =
    event.inviteFontStyle === "romantic_script"
      ? `${script} text-2xl sm:text-[2rem]`
      : event.inviteFontStyle === "soft_script"
        ? "text-[2rem] sm:text-[2.15rem] [font-family:var(--font-wedding-script-alt),cursive]"
        : event.inviteFontStyle === "modern_clean"
          ? "font-sans text-2xl tracking-wide"
          : event.inviteFontStyle === "classic_formal"
            ? "font-serif text-2xl uppercase tracking-[0.1em]"
            : `${serif} text-2xl`;
  const panelClass = "border-[#e7dccb] bg-[#fffdfa] shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]";
  const detailClass = "border-[#e7dccb] bg-[#fbf8f2]";

  const eventStartISO: string | null = event.eventDate
    ? (() => {
        const d = event.eventDate!;
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const time = event.eventTime?.trim() ?? "00:00";
        return `${yyyy}-${mm}-${dd}T${time}:00`;
      })()
    : null;

  const itinerary: ItineraryItem[] = Array.isArray(event.itinerary)
    ? (event.itinerary as ItineraryItem[]).filter(
        (x) =>
          x &&
          typeof x.title === "string" &&
          (typeof x.startTime === "string" || typeof x.time === "string"),
      )
    : [];

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      {/* Preview banner */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-200/90 bg-amber-50/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
        <p className="text-sm font-medium text-amber-950">
          Admin Preview — RSVP actions are disabled
          <span className="mx-2 text-amber-800/80">·</span>
          <Link
            href={`/admin/events/${event.id}`}
            className="font-medium text-amber-900 underline decoration-amber-700/50 underline-offset-2 hover:text-amber-950"
          >
            Back to event
          </Link>
        </p>
        <p className="mt-1 text-xs text-amber-900/85">
          Showing the invitation as a guest would see it. Guest name and capacity are placeholders.
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl space-y-5 pt-[4.5rem]">

        {/* ── 1. Hero: image + names + dear guest ── */}
        <ScrollReveal>
          <section className={`rounded-3xl border p-5 sm:p-8 ${panelClass}`}>
            <div className="space-y-7 text-center">

              {safeImageSrc ? (
                <div className="mx-auto w-full max-w-[30rem]">
                  <EventImageLightbox src={safeImageSrc} alt={event.title} hintText="Tap to enlarge invitation" />
                </div>
              ) : null}

              <div className="space-y-2">
                <h1 className={`leading-[1.15] text-zinc-900 ${headingClass}`}>{displayNames}</h1>
                {hasCoupleNames ? (
                  <p className={`text-base text-zinc-500 ${serif}`}>{event.title}</p>
                ) : null}
                {event.eventSubtitle ? (
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-500">{event.eventSubtitle}</p>
                ) : null}
              </div>

              <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent" aria-hidden />

              <div className={`mx-auto max-w-md rounded-2xl border px-5 py-5 text-center ${detailClass}`}>
                <p className={`text-zinc-900 ${salutationClass}`}>Dear Your Guest,</p>
                <p className="mt-3 text-base leading-relaxed text-zinc-700">
                  <span className="block">We would be honored to celebrate with you.</span>
                  <span className="mt-2 block">
                    Your invitation includes up to{" "}
                    <span className="font-semibold text-zinc-900">2</span>{" "}
                    guests.
                  </span>
                </p>
                {event.welcomeMessage ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700">{event.welcomeMessage}</p>
                ) : null}
                {event.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">{event.description}</p>
                ) : null}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── 2. Date + Time ── */}
        {(event.eventDate || event.eventTime) ? (
          <div className={event.eventDate && event.eventTime ? "grid grid-cols-2 items-stretch gap-3" : ""}>
            {event.eventDate ? (
              <ScrollReveal delay={60} className="h-full">
                <DateCard eventDate={event.eventDate} />
              </ScrollReveal>
            ) : null}
            {event.eventTime ? (
              <ScrollReveal delay={100} className="h-full">
                <TimeCard eventTime={event.eventTime} />
              </ScrollReveal>
            ) : null}
          </div>
        ) : null}

        {/* ── 3. Countdown ── */}
        {eventStartISO ? (
          <ScrollReveal delay={40}>
            <CountdownTimer eventStartISO={eventStartISO} />
          </ScrollReveal>
        ) : null}

        {/* ── 4. RSVP deadline notice ── */}
        {event.rsvpDeadline ? (
          <ScrollReveal delay={40}>
            <div className="space-y-2 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                RSVP by{" "}
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(event.rsvpDeadline)}
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
                    ? "Closes today"
                    : `Closes in ${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"}`}
                </p>
              ) : null}
            </div>
          </ScrollReveal>
        ) : null}

        {/* ── 5. RSVP form (disabled in preview) ── */}
        <ScrollReveal delay={60}>
          <section>
            <RsvpForm
              token="preview"
              maxGuests={2}
              isLocked={false}
              previewMode={true}
            />
          </section>
        </ScrollReveal>

        {/* ── 6. Itinerary ── */}
        {itinerary.length > 0 ? (
          <ScrollReveal delay={40}>
            <ItineraryTimeline items={itinerary} />
          </ScrollReveal>
        ) : null}

      </div>
    </main>
  );
}
