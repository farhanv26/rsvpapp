import { redirect } from "next/navigation";
import { RsvpPreviewContent } from "@/components/admin/rsvp-preview-content";
import { inviteSerif } from "@/components/invitation/invitation-parts";
import { guestVisibleItinerary } from "@/components/itinerary-timeline";
import type { ItineraryItem } from "@/components/itinerary-timeline";
import { getOptionalAdminUser } from "@/lib/admin-auth";
import { getEventAccess } from "@/lib/wedding-access";
import { readEventPreviewToken } from "@/lib/preview-token";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RsvpPreviewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = searchParams ? await searchParams : {};

  // Auth: web session, or a short-lived single-event preview grant (?pt=) issued to the mobile app.
  let admin = await getOptionalAdminUser();

  if (!admin) {
    const ptParam = sp.pt;
    const pt = Array.isArray(ptParam) ? ptParam[0] : ptParam;
    const grant = pt ? await readEventPreviewToken(pt) : null;
    if (grant && grant.eventId === eventId) {
      const row = await prisma.user.findFirst({
        where: { id: grant.userId, deletedAt: null },
        select: { id: true, name: true, role: true, active: true },
      });
      if (row?.active) {
        admin = { id: row.id, name: row.name, role: row.role };
      }
    }
  }

  if (!admin) {
    redirect("/admin/login");
  }

  const access = await getEventAccess(admin, eventId);
  if (access.status === "forbidden") {
    redirect("/admin/events");
  }

  const event =
    access.status !== "ok"
      ? null
      : await prisma.event.findFirst({
          where: { id: eventId, deletedAt: null },
          select: {
            id: true,
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
        <div className="invite-sheet w-full max-w-md px-8 py-10 text-center">
          <p className={`text-2xl text-[var(--inv-ink)] ${inviteSerif}`}>Event not found</p>
        </div>
      </main>
    );
  }

  // Private schedule items and planner notes are removed here, on the server, before anything renders.
  const itinerary: ItineraryItem[] = guestVisibleItinerary(
    Array.isArray(event.itinerary)
      ? (event.itinerary as ItineraryItem[]).filter(
          (x) => x && typeof x.title === "string" && (typeof x.startTime === "string" || typeof x.time === "string"),
        )
      : [],
  );

  return (
    <RsvpPreviewContent
      data={{
        title: event.title,
        coupleNames: event.coupleNames ?? "",
        eventSubtitle: event.eventSubtitle ?? "",
        eventDate: event.eventDate,
        eventTime: event.eventTime ?? "",
        venue: event.venue ?? "",
        welcomeMessage: event.welcomeMessage ?? "",
        description: event.description ?? "",
        inviteFontStyle: event.inviteFontStyle,
        rsvpDeadline: event.rsvpDeadline,
        itinerary,
        imagePath: event.imagePath ?? "",
        genericCardImage: event.genericCardImage ?? "",
        cardImage1: event.cardImage1 ?? "",
        cardImage2: event.cardImage2 ?? "",
        cardImage3: event.cardImage3 ?? "",
        cardImage4: event.cardImage4 ?? "",
        familyCardImage: event.familyCardImage ?? "",
      }}
    />
  );
}
