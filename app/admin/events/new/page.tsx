import Link from "next/link";
import { createEventAction } from "@/app/admin/events/actions";
import { EventImageUploadField } from "@/components/admin/event-image-upload-field";
import { EventSchedulingFields } from "@/components/admin/event-scheduling-fields";

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

      <form action={createEventAction} className="app-card space-y-6 p-6 sm:p-8">
        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <div>
            <p className="section-title">Event basics</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Core identity</h2>
            <p className="mt-1 text-sm text-zinc-600">Add details guests will see on their private invite page.</p>
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
                placeholder="Wedding Celebration"
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
                placeholder="Emma & Liam"
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
                placeholder="Together with their families..."
                className="input-luxe mt-0"
              />
            </div>
          </div>
        </section>

        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <EventSchedulingFields />
        </section>

        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <div>
            <p className="section-title">Appearance</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Invitation theme</h2>
            <p className="mt-1 text-sm text-zinc-600">Choose how the guest RSVP page is styled.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="app-card-muted flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dccfbb] p-4">
              <input type="radio" name="theme" value="modern" defaultChecked className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">Modern</span>
                <span className="mt-1 block text-xs text-zinc-600">Clean neutral palette with refined contrast.</span>
              </span>
            </label>
            <label className="app-card-muted flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dccfbb] p-4">
              <input type="radio" name="theme" value="floral" className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">Floral</span>
                <span className="mt-1 block text-xs text-zinc-600">Soft blush, sage accents, and romantic framing.</span>
              </span>
            </label>
          </div>
        </section>

        <section className="app-card-muted space-y-4 p-4 sm:p-5">
          <div>
            <p className="section-title">Ceremony details</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Location and messaging</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <textarea id="description" name="description" className="input-luxe mt-0 h-28" />
          </div>
        </section>

        <section className="app-card-muted space-y-3 p-4 sm:p-5">
          <div>
            <p className="section-title">Invitation card</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Upload invite image</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Use a clear PNG or JPG so guests see the full card beautifully.
            </p>
          </div>
          <EventImageUploadField />
        </section>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Link href="/admin/events" className="btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-40">
            Create Event
          </button>
        </div>
      </form>
    </main>
  );
}
