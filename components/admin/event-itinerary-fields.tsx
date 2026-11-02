"use client";

import { useState } from "react";
import { ITINERARY_ICONS, type ItineraryItem } from "@/components/itinerary-timeline";
import { guessItineraryIcon, ITINERARY_ICON_OPTIONS } from "@/lib/itinerary-icons";

type Props = {
  initialItems?: ItineraryItem[];
};

type EditableItem = ItineraryItem & { iconChosen?: boolean };

function ItemIconPreview({ name }: { name?: string }) {
  const Icon = name ? ITINERARY_ICONS[name] : undefined;
  if (!Icon) return null;
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
      <Icon size={13} strokeWidth={1.6} aria-hidden />
    </span>
  );
}

export function EventItineraryFields({ initialItems = [] }: Props) {
  const [items, setItems] = useState<EditableItem[]>(() =>
    initialItems.map((item) => ({ ...item, iconChosen: Boolean(item.icon && item.icon !== "CalendarDays") })),
  );

  function addItem() {
    setItems((prev) => [...prev, { startTime: "", endTime: "", title: "", icon: undefined, visibility: "guests" }]);
  }

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function moveItem(index: number, direction: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  }

  const serialized = JSON.stringify(
    items
      .filter((x) => (x.startTime ?? x.time ?? "").trim() && x.title.trim())
      .map((x) => ({
        startTime: x.startTime,
        time: x.time,
        endTime: x.endTime,
        title: x.title,
        icon: x.icon || guessItineraryIcon(x.title),
        description: x.description,
        visibility: x.visibility === "private" ? "private" : "guests",
        privateNotes: x.privateNotes,
      })),
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="itinerary" value={serialized} />

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-soft)] px-5 py-6 text-center">
          <p className="text-sm font-medium text-zinc-700">No schedule yet</p>
          <p className="mt-1 text-xs text-zinc-500">Add items to show timings on the invitation, or keep them for planning only.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => {
            const idBase = `itinerary-${i}`;
            return (
              <li key={i} className="rounded-xl border border-[var(--border-soft)] bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                  <div>
                    <label htmlFor={`${idBase}-title`} className="form-label">
                      Title
                    </label>
                    <input
                      id={`${idBase}-title`}
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(i, {
                          title: e.target.value,
                          ...(item.iconChosen ? {} : { icon: guessItineraryIcon(e.target.value) }),
                        })
                      }
                      placeholder="Ring ceremony"
                      className="input-luxe text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idBase}-icon`} className="form-label">
                      Icon
                    </label>
                    <div className="flex items-center gap-2">
                      <ItemIconPreview name={item.icon || guessItineraryIcon(item.title)} />
                      <select
                        id={`${idBase}-icon`}
                        value={item.icon || guessItineraryIcon(item.title)}
                        onChange={(e) => updateItem(i, { icon: e.target.value, iconChosen: true })}
                        className="input-luxe text-sm"
                      >
                        {ITINERARY_ICON_OPTIONS.map((opt) => (
                          <option key={opt.name} value={opt.name}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`${idBase}-start`} className="form-label">
                      Starts
                    </label>
                    <input
                      id={`${idBase}-start`}
                      type="text"
                      value={item.startTime ?? item.time ?? ""}
                      onChange={(e) => updateItem(i, { startTime: e.target.value })}
                      placeholder="6:00 PM"
                      className="input-luxe text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idBase}-end`} className="form-label">
                      Ends <span className="font-normal text-zinc-500">(optional)</span>
                    </label>
                    <input
                      id={`${idBase}-end`}
                      type="text"
                      value={item.endTime ?? ""}
                      onChange={(e) => updateItem(i, { endTime: e.target.value })}
                      placeholder="7:00 PM"
                      className="input-luxe text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={`${idBase}-visibility`} className="form-label">
                      Shown to
                    </label>
                    <select
                      id={`${idBase}-visibility`}
                      value={item.visibility === "private" ? "private" : "guests"}
                      onChange={(e) => updateItem(i, { visibility: e.target.value === "private" ? "private" : "guests" })}
                      className="input-luxe text-sm"
                    >
                      <option value="guests">Guests and planners</option>
                      <option value="private">Planners only</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${idBase}-desc`} className="form-label">
                      Note for guests <span className="font-normal text-zinc-500">(optional)</span>
                    </label>
                    <input
                      id={`${idBase}-desc`}
                      type="text"
                      value={item.description ?? ""}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="Please be seated by 5:45"
                      className="input-luxe text-sm"
                      disabled={item.visibility === "private"}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idBase}-private`} className="form-label">
                      Planning note <span className="font-normal text-zinc-500">(never shown to guests)</span>
                    </label>
                    <input
                      id={`${idBase}-private`}
                      type="text"
                      value={item.privateNotes ?? ""}
                      onChange={(e) => updateItem(i, { privateNotes: e.target.value })}
                      placeholder="DJ arrives 4:30, confirm mic"
                      className="input-luxe text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveItem(i, "up")}
                    disabled={i === 0}
                    aria-label={`Move "${item.title || `item ${i + 1}`}" up`}
                    className="btn-secondary h-8 px-2.5 py-0 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(i, "down")}
                    disabled={i === items.length - 1}
                    aria-label={`Move "${item.title || `item ${i + 1}`}" down`}
                    className="btn-secondary h-8 px-2.5 py-0 text-xs"
                  >
                    ↓
                  </button>
                  <span className="ml-1 text-xs text-zinc-500">
                    {i + 1} of {items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="btn-secondary ml-auto h-8 px-3 py-0 text-xs text-rose-800"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" onClick={addItem} className="btn-secondary w-full">
        Add schedule item
      </button>
    </div>
  );
}
