import Link from "next/link";
import { createEventAction } from "@/app/admin/events/actions";

export default function NewEventPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <Link href="/admin/events" className="text-sm text-zinc-600">
          ← Back to events
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Create Wedding Event</h1>
      </div>

      <form action={createEventAction} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="coupleNames" className="mb-2 block text-sm font-medium">
              Couple names (optional)
            </label>
            <input
              id="coupleNames"
              name="coupleNames"
              type="text"
              placeholder="Emma & Liam"
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
              placeholder="Wedding Celebration"
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
              placeholder="Together with their families..."
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
              placeholder="4:30 PM"
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
              placeholder="Rosewood Estate, Napa Valley"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
            />
          </div>
        </div>

        <div>
          <label htmlFor="welcomeMessage" className="mb-2 block text-sm font-medium">
            Welcome message (optional)
          </label>
          <textarea
            id="welcomeMessage"
            name="welcomeMessage"
            className="h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
            placeholder="We are so excited to celebrate with you."
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            className="h-28 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label htmlFor="image" className="mb-2 block text-sm font-medium">
            Invitation image (PNG/JPG, optional)
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
          Create Event
        </button>
      </form>
    </main>
  );
}
