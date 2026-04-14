import Link from "next/link";
import { createEventAction } from "@/app/admin/events/actions";

export default function NewEventPage() {
  return (
    <main className="app-shell max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/events" className="text-sm font-medium text-zinc-600">
          ← Back to events
        </Link>
        <h1 className="headline-display mt-3 text-3xl">Create wedding event</h1>
        <p className="mt-2 text-sm text-zinc-600">Set the core details first, then add guests and invite links.</p>
      </div>

      <form action={createEventAction} className="app-card space-y-5 p-6 sm:p-7">
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
              placeholder="Wedding Celebration"
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
              placeholder="Together with their families..."
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
              placeholder="4:30 PM"
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
              placeholder="Rosewood Estate, Napa Valley"
              className="input-luxe mt-0"
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
            className="input-luxe mt-0 h-24"
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
            className="input-luxe mt-0 h-28"
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
            className="w-full rounded-2xl border border-[#dccfbb] bg-white px-4 py-3 text-base file:mr-3 file:rounded-xl file:border-0 file:bg-[#efe3d2] file:px-3 file:py-2 file:text-sm"
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          Create Event
        </button>
      </form>
    </main>
  );
}
