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
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-5">
        <Link href={`/admin/events/${event.id}`} className="text-sm text-zinc-600">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit Wedding Event</h1>
      </div>

      <form action={updateEventAction} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6">
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
            className="h-28 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
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
            className="h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
          />
        </div>

        {event.imagePath ? (
          <div>
            <p className="mb-2 text-sm font-medium">Current image</p>
            <div className="relative h-40 w-full overflow-hidden rounded-xl">
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
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-base font-semibold text-white"
        >
          Save Event Changes
        </button>
      </form>
    </main>
  );
}
