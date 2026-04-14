import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";
import { SafeEventImage } from "@/components/safe-event-image";
import { prisma } from "@/lib/prisma";
import { getSafeImageSrc } from "@/lib/utils";

type Props = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: Props) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
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

      <form action={updateEventAction} className="app-card space-y-5 p-6 sm:p-7">
        <input type="hidden" name="eventId" value={event.id} />
        <div className="grid gap-4 sm:grid-cols-2">
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
          <EventSchedulingFields
            eventDateDefault={event.eventDate ? event.eventDate.toISOString().slice(0, 10) : ""}
            rsvpDeadlineDefault={event.rsvpDeadline ? event.rsvpDeadline.toISOString().slice(0, 10) : ""}
          />
          <div>
            <label htmlFor="eventTime" className="mb-2 block text-sm font-medium">
              Event time (optional)
            </label>
            <input
              id="eventTime"
              name="eventTime"
              type="text"
              defaultValue={event.eventTime ?? ""}
              className="input-luxe mt-0"
            />
          </div>
          <div className="sm:col-span-2">
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

        <EventImageUploadField initialImagePath={event.imagePath} />

        <button type="submit" className="btn-primary w-full">
          Save Event Changes
        </button>
      </form>
    </main>
  );
}
