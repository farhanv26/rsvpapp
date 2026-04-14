import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEventAction } from "@/app/admin/events/actions";
import { prisma } from "@/lib/prisma";

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
          <div>
            <label htmlFor="eventDate" className="mb-2 block text-sm font-medium">
              Event date (optional)
            </label>
            <input
              id="eventDate"
              name="eventDate"
              type="date"
              defaultValue={event.eventDate ? event.eventDate.toISOString().slice(0, 10) : ""}
              className="input-luxe mt-0"
            />
          </div>
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

        {event.imagePath ? (
          <div>
            <p className="mb-2 text-sm font-medium">Current image</p>
            <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-[#e3d8c7]">
              <Image src={event.imagePath} alt={event.title} fill className="object-cover" />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="image" className="mb-2 block text-sm font-medium">
            Replace image (optional)
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="w-full rounded-2xl border border-[#dccfbb] bg-white px-4 py-3 text-base file:mr-3 file:rounded-xl file:border-0 file:bg-[#efe3d2] file:px-3 file:py-2 file:text-sm"
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          Save Event Changes
        </button>
      </form>
    </main>
  );
}
