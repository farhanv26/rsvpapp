import Image from "next/image";
import { RsvpForm } from "@/components/rsvp-form";
import { InvitationArchRule, InvitationCornerFloral } from "@/components/wedding-invitation-decor";
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
  const dateLine = eventDate
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(eventDate)
    : null;

  return (
    <div className="mx-auto max-w-sm space-y-5 px-1">
      <InvitationArchRule className="opacity-80" />
      <div className="space-y-5 text-center">
        {dateLine ? (
          <div>
            <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-[#9a7b2c]/85 ${serif}`}>
              The day
            </p>
            <p className={`mt-2 text-lg leading-snug text-[#3d3429] ${serif}`}>{dateLine}</p>
          </div>
        ) : null}
        {eventTime ? (
          <div>
            <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-[#9a7b2c]/85 ${serif}`}>
              Time
            </p>
            <p className={`mt-2 text-base text-[#4a4238] ${serif}`}>{eventTime}</p>
          </div>
        ) : null}
        {venue ? (
          <div>
            <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-[#9a7b2c]/85 ${serif}`}>
              Venue
            </p>
            <p className={`mt-2 text-base leading-relaxed text-[#4a4238] ${serif}`}>{venue}</p>
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
      <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <InvitationCornerFloral className="absolute left-2 top-4 h-24 w-24 text-[#b8963a]/30 sm:h-28 sm:w-28" />
          <InvitationCornerFloral className="absolute right-2 top-4 h-24 w-24 scale-x-[-1] text-[#b8963a]/30 sm:h-28 sm:w-28" />
        </div>
        <div
          className={`relative z-10 w-full max-w-md rounded-[2rem] border border-[#d4af37]/35 bg-[#fdfcf9]/95 px-8 py-12 text-center shadow-[0_28px_80px_-48px_rgba(90,70,40,0.45)] ring-1 ring-[#e8dcc4]/80 backdrop-blur-sm`}
        >
          <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-[#9a7b2c] ${serif}`}>
            Invitation
          </p>
          <h1 className={`mt-4 text-3xl leading-tight text-[#2c2419] ${serif}`}>This invitation link could not be opened</h1>
          <p className="mt-5 text-sm leading-relaxed text-[#5c5349]">
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
    <main className="relative flex min-h-dvh flex-col justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-6">
      {/* Ornamental corners — subtle, fixed to viewport edges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <InvitationCornerFloral className="absolute left-1 top-2 h-28 w-28 text-[#c9a227]/28 sm:left-3 sm:top-4 sm:h-36 sm:w-36" />
        <InvitationCornerFloral className="absolute right-1 top-2 h-28 w-28 scale-x-[-1] text-[#c9a227]/28 sm:right-3 sm:top-4 sm:h-36 sm:w-36" />
        <InvitationCornerFloral className="absolute bottom-2 left-1 h-28 w-28 scale-y-[-1] text-[#c9a227]/24 sm:bottom-4 sm:left-3 sm:h-36 sm:w-36" />
        <InvitationCornerFloral className="absolute bottom-2 right-1 h-28 w-28 scale-[-1] text-[#c9a227]/24 sm:bottom-4 sm:right-3 sm:h-36 sm:w-36" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg">
        {/* Outer arch-inspired frame */}
        <section className="rsvp-fade-up rounded-[2.25rem] border border-[#d4af37]/45 bg-[linear-gradient(180deg,#fffdf9_0%,#faf6ef_100%)] p-[3px] shadow-[0_32px_90px_-50px_rgba(80,60,30,0.55)]">
          <div className="rounded-[2.1rem] border border-[#c9a227]/55 bg-[#fdfbf7] p-1 sm:p-1.5">
            <div className="rounded-[1.95rem] border border-[#e5d9c4]/90 bg-[#fffcf7] px-4 pb-8 pt-6 sm:px-7 sm:pb-10 sm:pt-8">
              {/* Invitation image — framed like a card, not a raw upload */}
              {ev.imagePath ? (
                <div className="relative mx-auto mb-8 max-w-[92%]">
                  <div className="rounded-[1.35rem] border border-[#d4af37]/40 bg-[#fffdf9] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.05rem] bg-[#f7f0e4]">
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
                </div>
              ) : (
                <div className="relative mx-auto mb-8 aspect-[4/5] max-w-[88%] overflow-hidden rounded-[1.35rem] border border-[#d4af37]/35 bg-[linear-gradient(165deg,#fffdf9_0%,#f3e9dc_55%,#ebe0d2_100%)] px-6 py-14 text-center shadow-inner sm:py-16">
                  <InvitationArchRule className="mb-8 opacity-60" />
                  <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-[#9a7b2c] ${serif}`}>
                    Together with their families
                  </p>
                  <p className={`mt-6 text-[2.65rem] leading-[1.12] text-[#2c2419] sm:text-[3rem] ${script}`}>
                    {displayNames}
                  </p>
                </div>
              )}

              <div className="space-y-7 text-center">
                {ev.imagePath ? (
                  <>
                    <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-[#9a7b2c] ${serif}`}>
                      With love
                    </p>
                    <h1
                      className={`text-[2.5rem] leading-[1.15] text-[#2c2419] sm:text-[2.85rem] ${showScriptNames ? script : serif}`}
                    >
                      {showScriptNames ? ev.coupleNames!.trim() : ev.title}
                    </h1>
                    {showScriptNames ? (
                      <p className={`text-lg font-medium text-[#5c5349] ${serif}`}>{ev.title}</p>
                    ) : null}
                  </>
                ) : null}

                {!ev.imagePath && ev.coupleNames ? (
                  <p className={`text-lg font-medium text-[#5c5349] ${serif}`}>{ev.title}</p>
                ) : null}

                {ev.eventSubtitle ? (
                  <p className={`text-sm italic leading-relaxed text-[#6b6258] ${serif}`}>{ev.eventSubtitle}</p>
                ) : null}

                {hasCeremonyDetails ? (
                  <CeremonyDetails eventDate={ev.eventDate} eventTime={ev.eventTime} venue={ev.venue} />
                ) : null}

                {ev.welcomeMessage ? (
                  <p className={`mx-auto max-w-sm text-sm leading-[1.85] text-[#5c5349] ${serif}`}>{ev.welcomeMessage}</p>
                ) : null}
                {ev.description ? (
                  <p className={`mx-auto max-w-sm text-sm leading-[1.85] text-[#5c5349] ${serif}`}>{ev.description}</p>
                ) : null}

                {/* Personalized greeting */}
                <div className="mx-auto max-w-sm rounded-2xl border border-[#e8dcc4]/90 bg-[linear-gradient(145deg,#fffdf9_0%,#f8f0e4_100%)] px-5 py-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#9a7b2c] ${serif}`}>
                    A note for you
                  </p>
                  <p className={`mt-3 text-2xl text-[#2c2419] ${script}`}>Dear {guest.guestName}</p>
                  <p className={`mt-4 text-sm leading-relaxed text-[#5c5349] ${serif}`}>
                    We would be honored to celebrate with you. Please let us know if you will be joining us—your
                    invitation graciously includes up to{" "}
                    <span className="font-semibold text-[#3d3429]">{guest.maxGuests}</span>{" "}
                    {guest.maxGuests === 1 ? "guest" : "guests"}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Divider + RSVP / confirmation */}
        <div className="rsvp-fade-up mt-10 flex flex-col items-center gap-10 sm:mt-12 [animation-delay:90ms]">
          <div className="flex w-full max-w-xs items-center gap-3 sm:gap-4">
            <InvitationArchRule />
            <span className={`shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-[#9a7b2c] ${serif}`}>
              R.S.V.P.
            </span>
            <InvitationArchRule />
          </div>

          {hasResponded ? (
            <div
              className={`rsvp-fade-up w-full rounded-[1.85rem] border border-[#d4af37]/35 bg-[#fdfcf9] px-6 py-10 text-center shadow-[0_24px_70px_-44px_rgba(80,60,30,0.4)] ${serif}`}
            >
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-[#9a7b2c]">With gratitude</p>
              <h2 className={`mt-3 font-[family-name:var(--font-wedding-script)] text-3xl text-[#2c2419]`}>
                Thank you for your response
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-[1.85] text-[#5c5349]">
                {guest.attending ? (
                  <>
                    Your RSVP has been received with love. We have you down for{" "}
                    <span className="font-semibold text-[#3d3429]">{guest.attendingCount ?? 0}</span>{" "}
                    {(guest.attendingCount ?? 0) === 1 ? "guest" : "guests"}. We look forward to celebrating with you.
                  </>
                ) : (
                  <>
                    Your RSVP has been received with love. We will hold you in our hearts and hope our paths cross again
                    soon.
                  </>
                )}
              </p>
              <p className="mt-8 text-[0.68rem] uppercase tracking-[0.22em] text-[#a39a8f]">
                Recorded {formatDateTime(guest.respondedAt)}
              </p>
            </div>
          ) : (
            <RsvpForm token={token} maxGuests={guest.maxGuests} isLocked={hasResponded} />
          )}
        </div>
      </div>
    </main>
  );
}
