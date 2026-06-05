"use client";

import { CountdownTimer } from "@/components/countdown-timer";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { ItineraryTimeline } from "@/components/itinerary-timeline";
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

const script = "font-[family-name:var(--font-wedding-script),cursive]";
const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

function formatEventTime(raw: string | null) {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return raw;
  const h24 = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h24) || !Number.isFinite(min)) return raw;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

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

  const style = data.inviteFontStyle;
  const headingClass =
    style === "romantic_script" ? `${script} text-[2.6rem] sm:text-[3rem]`
    : style === "soft_script" ? "text-[2.5rem] sm:text-[2.9rem] [font-family:var(--font-wedding-script-alt),cursive]"
    : style === "modern_clean" ? "font-sans text-4xl tracking-wide"
    : style === "classic_formal" ? "font-serif text-4xl uppercase tracking-[0.14em]"
    : `${serif} text-4xl`;

  const salutationClass =
    style === "romantic_script" ? `${script} text-2xl sm:text-[2rem]`
    : style === "soft_script" ? "text-[2rem] sm:text-[2.15rem] [font-family:var(--font-wedding-script-alt),cursive]"
    : style === "modern_clean" ? "font-sans text-2xl tracking-wide"
    : style === "classic_formal" ? "font-serif text-2xl uppercase tracking-[0.1em]"
    : `${serif} text-2xl`;

  const panelClass = "border-[#e7dccb] bg-[#fffdfa] shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]";
  const detailClass = "border-[#e7dccb] bg-[#fbf8f2]";

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

  const content = (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-5">

        {/* ── 1. Hero ── */}
        <ScrollReveal>
          <section className={`rounded-3xl border p-5 sm:p-8 ${panelClass}`}>
            <div className="space-y-7 text-center">
              {safeImageSrc ? (
                <div className="mx-auto w-full max-w-[30rem]">
                  <EventImageLightbox src={safeImageSrc} alt={data.title} hintText="Tap to enlarge invitation" />
                </div>
              ) : null}
              <div className="space-y-2">
                <h1 className={`leading-[1.15] text-zinc-900 ${headingClass}`}>{displayNames}</h1>
                {hasCoupleNames ? <p className={`text-base text-zinc-500 ${serif}`}>{data.title}</p> : null}
                {data.eventSubtitle ? <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-500">{data.eventSubtitle}</p> : null}
              </div>
              <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent" aria-hidden />
              <div className={`mx-auto max-w-md rounded-2xl border px-5 py-5 text-center ${detailClass}`}>
                <p className={`text-zinc-900 ${salutationClass}`}>Dear Your Guest,</p>
                <p className="mt-3 text-base leading-relaxed text-zinc-700">
                  <span className="block">We would be honored to celebrate with you.</span>
                  <span className="mt-2 block">
                    Your invitation includes up to <span className="font-semibold text-zinc-900">2</span> guests.
                  </span>
                </p>
                {data.welcomeMessage ? <p className="mt-3 text-sm leading-relaxed text-zinc-700">{data.welcomeMessage}</p> : null}
                {data.description ? <p className="mt-3 text-sm leading-relaxed text-zinc-600">{data.description}</p> : null}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* ── 2. Date + Time ── */}
        {(data.eventDate || data.eventTime) ? (
          <div className={data.eventDate && data.eventTime ? "grid grid-cols-2 items-stretch gap-3" : ""}>
            {data.eventDate ? (
              <ScrollReveal delay={60} className="h-full"><DateCard eventDate={data.eventDate} /></ScrollReveal>
            ) : null}
            {data.eventTime ? (
              <ScrollReveal delay={100} className="h-full"><TimeCard eventTime={data.eventTime} /></ScrollReveal>
            ) : null}
          </div>
        ) : null}

        {/* ── 3. Countdown ── */}
        {eventStartISO ? (
          <ScrollReveal delay={40}><CountdownTimer eventStartISO={eventStartISO} /></ScrollReveal>
        ) : null}

        {/* ── 4. Deadline notice ── */}
        {data.rsvpDeadline ? (
          <ScrollReveal delay={40}>
            <div className="space-y-2 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                RSVP by{" "}
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(data.rsvpDeadline)}
              </p>
              {(deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today") ? (
                <p className={`mx-auto w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                  deadlineMeta.status === "closes_today" ? "bg-rose-100 text-rose-800"
                  : deadlineMeta.daysRemaining <= 3 ? "bg-amber-100 text-amber-900"
                  : "bg-zinc-100 text-zinc-700"
                }`}>
                  {deadlineMeta.status === "closes_today"
                    ? "Closes today"
                    : `Closes in ${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"}`}
                </p>
              ) : null}
            </div>
          </ScrollReveal>
        ) : null}

        {/* ── 5. RSVP form (disabled) ── */}
        <ScrollReveal delay={60}>
          <section>
            <RsvpForm token="preview" maxGuests={2} isLocked={false} previewMode={true} />
          </section>
        </ScrollReveal>

        {/* ── 6. Itinerary ── */}
        {data.itinerary.length > 0 ? (
          <ScrollReveal delay={40}><ItineraryTimeline items={data.itinerary} /></ScrollReveal>
        ) : null}

        {/* ── 7. Map (always shown in preview) ── */}
        {data.venue ? (
          <ScrollReveal delay={40}>
            <div className="space-y-1">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80">
                Visible after guest confirms attendance
              </p>
              <VenueMapButton venue={data.venue} />
            </div>
          </ScrollReveal>
        ) : null}

        {/* ── 8. Calendar (always shown in preview) ── */}
        {calendarPayload ? (
          <ScrollReveal delay={60}>
            <div className="space-y-1 pb-2">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80">
                Visible after guest confirms attendance
              </p>
              <div className="text-center">
                <CalendarModal icsDataUrl={calendarPayload.icsDataUrl} googleUrl={calendarPayload.googleUrl} />
              </div>
            </div>
          </ScrollReveal>
        ) : null}

      </div>
    </main>
  );

  return <EnvelopeReveal guestName="Your Guest">{content}</EnvelopeReveal>;
}
