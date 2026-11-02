import {
  BookOpen,
  Cake,
  CalendarDays,
  Camera,
  Car,
  Coffee,
  Crown,
  Flower2,
  Gem,
  Gift,
  Handshake,
  Heart,
  MapPin,
  Mic2,
  Moon,
  Music,
  PartyPopper,
  Sparkles,
  Star,
  Sun,
  Users,
  Utensils,
  Video,
  Wine,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

export const ITINERARY_ICONS: Record<string, ComponentType<LucideProps>> = {
  BookOpen,
  Cake,
  CalendarDays,
  Camera,
  Car,
  Coffee,
  Crown,
  Flower2,
  Gem,
  Gift,
  Handshake,
  Heart,
  MapPin,
  Mic2,
  Moon,
  Music,
  PartyPopper,
  Sparkles,
  Star,
  Sun,
  Users,
  Utensils,
  Video,
  Wine,
};

export type ItineraryItem = {
  /** Legacy field — used as fallback if startTime is absent */
  time?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  icon?: string;
  /** Shown to guests under the title. */
  description?: string | null;
  /** "private" items appear only on planner screens. Missing = guests (legacy items). */
  visibility?: "guests" | "private";
  /** Planner-only note; must never reach guest pages. */
  privateNotes?: string | null;
};

/** Server-side filter for anything rendered to guests: drops private items and planner notes. */
export function guestVisibleItinerary(items: ItineraryItem[]): ItineraryItem[] {
  return items
    .filter((item) => item.visibility !== "private")
    .map((item) => {
      const rest = { ...item };
      delete rest.privateNotes;
      delete rest.visibility;
      return rest;
    });
}

function getDisplayTime(item: ItineraryItem): string {
  const start = item.startTime ?? item.time ?? "";
  if (!start) return "";
  return item.endTime ? `${start} – ${item.endTime}` : start;
}

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/baraat|barat/i, "PartyPopper"],
  [/haldi|mehndi|mehendi/i, "Flower2"],
  [/ring|gem|jewel|diamond|engagement/i, "Gem"],
  [/nikkah|nikah|aqd|ceremony|vow|wedding/i, "Heart"],
  [/dance|dj\b|band|entertainment|performance/i, "Music"],
  [/dinner|lunch|breakfast|food|meal|dining|buffet|eat|biryani/i, "Utensils"],
  [/photo|photograph|camera|picture|portrait/i, "Camera"],
  [/cake|dessert|sweet|cutting/i, "Cake"],
  [/cocktail|drink|\bbar\b|wine|champagne|toast|alcohol/i, "Wine"],
  [/speech|mc\b|microphone|address/i, "Mic2"],
  [/firework|confetti|sparkle/i, "Sparkles"],
  [/flower|floral|bouquet|haldi/i, "Flower2"],
  [/video|film|cinema/i, "Video"],
  [/reception|party|celebration/i, "PartyPopper"],
  [/coffee|brunch|tea/i, "Coffee"],
  [/transport|shuttle|bus\b|transfer/i, "Car"],
  [/prayer|salah|namaz|dua|quran|reading|book/i, "BookOpen"],
  [/gift|present/i, "Gift"],
  [/welcome|greet|handshake/i, "Handshake"],
  [/arrival|venue|location|entrance/i, "MapPin"],
  [/star|highlight|special/i, "Star"],
  [/family|group|gathering/i, "Users"],
  [/night|evening|dusk/i, "Moon"],
  [/outdoor|garden|park|lawn/i, "Sun"],
  [/crown|vip/i, "Crown"],
];

function guessIconFromTitle(title: string): string {
  for (const [re, icon] of KEYWORD_MAP) {
    if (re.test(title)) return icon;
  }
  return "CalendarDays";
}

function ItemIcon({ name, title }: { name?: string; title: string }) {
  // Treat "CalendarDays" as unset — fall through to keyword matching so stored fallbacks get real icons
  const resolved = (name && name !== "CalendarDays" && ITINERARY_ICONS[name]) ? name : guessIconFromTitle(title);
  const Icon = ITINERARY_ICONS[resolved] ?? CalendarDays;
  return <Icon size={15} strokeWidth={1.6} aria-hidden />;
}

/** `planner` shows "Planners only" items and planning notes; never set it on a guest page. */
export function ItineraryTimeline({ items, planner = false }: { items: ItineraryItem[]; planner?: boolean }) {
  const heading = planner ? null : "Schedule";
  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--inv-rule,#e2dcd0)] bg-[var(--inv-sheet,#fffefb)]">
      {heading ? (
        <h2 className={`border-b border-[var(--inv-rule,#e2dcd0)] px-5 py-4 text-center text-xl leading-snug text-[var(--inv-ink,#1c1915)] ${serif}`}>{heading}</h2>
      ) : null}
      <ol className="divide-y divide-[var(--inv-rule,#e2dcd0)]">
        {items.map((item, i) => {
          const displayTime = getDisplayTime(item);
          return (
            <li key={i} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-4 px-5 py-3.5 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <p className="pt-0.5 text-[13px] font-semibold leading-snug text-[var(--inv-accent,#7a2e63)] tabular-nums">
                {displayTime ? (
                  displayTime.includes("–") ? (
                    <>
                      {displayTime.split("–")[0].trim()}
                      <span className="block font-normal text-[var(--inv-muted,#5e574d)]">to {displayTime.split("–")[1].trim()}</span>
                    </>
                  ) : (
                    displayTime
                  )
                ) : null}
              </p>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-[var(--inv-muted,#5e574d)]">
                  <ItemIcon name={item.icon} title={item.title} />
                </span>
                <div className="min-w-0">
                  <p className={`text-[1.05rem] leading-snug break-words text-[var(--inv-ink,#1c1915)] ${serif}`}>
                    {item.title}
                    {planner && item.visibility === "private" ? (
                      <span className="ml-2 align-middle font-sans text-xs font-semibold text-[var(--accent)]">Planners only</span>
                    ) : null}
                  </p>
                  {item.description && (!planner || item.visibility !== "private") ? (
                    <p className="mt-0.5 text-sm leading-relaxed text-[var(--inv-muted,#5e574d)]">{item.description}</p>
                  ) : null}
                  {planner && item.privateNotes ? <p className="mt-0.5 text-[13px] text-[var(--muted-text)]">Note: {item.privateNotes}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
