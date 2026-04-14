import Image from "next/image";
import { RsvpForm } from "@/components/rsvp-form";
import { formatDateTime } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const script = "font-[family-name:var(--font-wedding-script),cursive]";
const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

type Props = {
  params: Promise<{ token: string }>;
};

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
      <div className="grid gap-4 text-center sm:grid-cols-3 sm:text-left">
        {dateLine ? (
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Date</p>
            <p className="mt-1 text-sm leading-snug text-zinc-800">{dateLine}</p>
          </div>
        ) : null}
        {eventTime ? (
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Time</p>
            <p className="mt-1 text-sm text-zinc-800">{eventTime}</p>
          </div>
        ) : null}
        {venue ? (
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Venue</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-800">{venue}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function RsvpTokenPage({ params }: Props) {
  const { token } = await params;
  const guest = await prisma.guest.findUnique({
    where: { token },
    include: {
      event: {
        select: {
          title: true,
          description: true,
          imagePath: true,
          coupleNames: true,
          eventSubtitle: true,
          eventDate: true,
          eventTime: true,
          venue: true,
          welcomeMessage: true,
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

  const hasResponded = Boolean(guest.respondedAt);
  const ev = guest.event;
  const hasCeremonyDetails = Boolean(ev.eventDate || ev.eventTime || ev.venue);
  const displayNames = ev.coupleNames?.trim() || ev.title;
  const showScriptNames = Boolean(ev.coupleNames?.trim());

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <section className="rsvp-fade-up rounded-3xl border border-[#e7dccb] bg-[#fffdfa] p-5 shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)] sm:p-7">
          <div className="space-y-6 text-center">
            {ev.imagePath ? (
              <div className="relative mx-auto max-w-[26rem]">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#f7f4ee]">
                  <Image
                    src={ev.imagePath}
                    alt={ev.title}
                    fill
                    priority
                    sizes="(max-width: 640px) 92vw, 26rem"
                    className="object-contain object-center"
                  />
                </div>
              </div>
            ) : null}

            <div>
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

            <div className="mx-auto max-w-md rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-5 py-5 text-left">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">Dear {guest.guestName}</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                We would be honored to celebrate with you. Your invitation includes up to{" "}
                <span className="font-semibold text-zinc-900">{guest.maxGuests}</span>{" "}
                {guest.maxGuests === 1 ? "guest" : "guests"}.
              </p>
              {ev.welcomeMessage ? <p className="mt-3 text-sm leading-relaxed text-zinc-700">{ev.welcomeMessage}</p> : null}
              {ev.description ? <p className="mt-3 text-sm leading-relaxed text-zinc-600">{ev.description}</p> : null}
            </div>
          </div>
        </section>

        <section className="rsvp-fade-up [animation-delay:90ms]">
          {hasResponded ? (
            <div className="w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-6 py-9 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">RSVP received</p>
              <h2 className={`mt-3 text-3xl text-zinc-900 ${script}`}>Thank you for your response</h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
                {guest.attending ? (
                  <>
                    We have you confirmed for{" "}
                    <span className="font-semibold text-zinc-900">{guest.attendingCount ?? 0}</span>{" "}
                    {(guest.attendingCount ?? 0) === 1 ? "guest" : "guests"}.
                  </>
                ) : (
                  <>We have received your RSVP. Thank you for letting us know.</>
                )}
              </p>
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-zinc-500">Recorded {formatDateTime(guest.respondedAt)}</p>
            </div>
          ) : (
            <RsvpForm token={token} maxGuests={guest.maxGuests} isLocked={hasResponded} />
          )}
        </section>
      </div>
    </main>
  );
}
