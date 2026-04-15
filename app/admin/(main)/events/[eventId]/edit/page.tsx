import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";
import { SafeEventImage } from "@/components/safe-event-image";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getSafeImageSrc } from "@/lib/utils";

type Props = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: Props) {
  const admin = await requireCurrentAdminUser();
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      ownerUserId: true,
      title: true,
      coupleNames: true,
      eventSubtitle: true,
      eventDate: true,
      rsvpDeadline: true,
      eventTime: true,
      venue: true,
      description: true,
      welcomeMessage: true,
      imagePath: true,
    },
  });
  if (!event) {
    notFound();
  }
  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    notFound();
  }
  const safeImageSrc = getSafeImageSrc(event.imagePath);
  console.info("[event-image] admin edit render src", {
    eventId: event.id,
    rawImagePath: event.imagePath,
    safeImageSrc,
  });

  return (
    <main className="app-shell max-w-4xl">
      <div className="mb-5">
        <Link href={`/admin/events/${event.id}`} className="text-sm font-medium text-zinc-600">
          ← Back to dashboard
        </Link>
        <h1 className="headline-display mt-3 text-3xl">Edit wedding event</h1>
      </div>

      <form action={updateEventAction} className="app-card space-y-6 p-6 sm:p-8">
        <input type="hidden" name="eventId" value={event.id} />
        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <div>
            <p className="section-title">Event basics</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Core identity</h2>
            <p className="mt-1 text-sm text-zinc-600">Update the invite headline and names shown to guests.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="mb-2 block text-sm font-medium">
                Event title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={event.title}
                className="input-luxe mt-0"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="coupleNames" className="mb-2 block text-sm font-medium">
                Couple names (optional)
              </label>
              <input
                id="coupleNames"
                name="coupleNames"
                type="text"
                defaultValue={event.coupleNames ?? ""}
                className="input-luxe mt-0"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eventSubtitle" className="mb-2 block text-sm font-medium">
                Event subtitle (optional)
              </label>
              <input
                id="eventSubtitle"
                name="eventSubtitle"
                type="text"
                defaultValue={event.eventSubtitle ?? ""}
                className="input-luxe mt-0"
              />
            </div>
          </div>
        </section>

        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <EventSchedulingFields
            eventDateDefault={event.eventDate ? event.eventDate.toISOString().slice(0, 10) : ""}
            rsvpDeadlineDefault={event.rsvpDeadline ? event.rsvpDeadline.toISOString().slice(0, 10) : ""}
            eventTimeDefault={event.eventTime ?? ""}
          />
        </section>

        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <div>
            <p className="section-title">Ceremony details</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Location and messaging</h2>
          </div>
          <div>
            <label htmlFor="venue" className="mb-2 block text-sm font-medium">
              Venue (optional)
            </label>
            <input
              id="venue"
              name="venue"
              type="text"
              defaultValue={event.venue ?? ""}
              className="input-luxe mt-0"
            />
          </div>
          <div>
            <label htmlFor="welcomeMessage" className="mb-2 block text-sm font-medium">
              Welcome message (optional)
            </label>
            <textarea
              id="welcomeMessage"
              name="welcomeMessage"
              defaultValue={event.welcomeMessage ?? ""}
              className="input-luxe mt-0 h-24"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={event.description ?? ""}
              className="input-luxe mt-0 h-28"
            />
          </div>
        </section>

        {safeImageSrc ? (
          <div>
            <p className="mb-2 text-sm font-medium">Current image</p>
            <div className="rounded-2xl border border-[#e3d8c7] bg-[#f7f2e9] p-3">
              <div className="relative h-52 w-full overflow-hidden rounded-xl border border-[#e7dccb] bg-[#fffdfa]">
                <SafeEventImage
                  src={safeImageSrc}
                  alt={event.title}
                  fill
                  className="object-contain object-center"
                  fallbackLabel="Invitation image unavailable"
                />
              </div>
            </div>
          </div>
        ) : null}

        <section className="app-card-muted space-y-3 p-4 sm:p-5">
          <div>
            <p className="section-title">Invitation card</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Replace invite image</h2>
          </div>
          <EventImageUploadField initialImagePath={event.imagePath} />
        </section>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Link href={`/admin/events/${event.id}`} className="btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-44">
            Save Event Changes
          </button>
        </div>
      </form>
    </main>
  );
}
