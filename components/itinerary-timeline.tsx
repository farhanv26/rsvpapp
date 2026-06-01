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
  description?: string | null;
};

function getDisplayTime(item: ItineraryItem): string {
  const start = item.startTime ?? item.time ?? "";
  if (!start) return "";
  return item.endTime ? `${start} – ${item.endTime}` : start;
}

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/ring|gem|jewel|diamond|engagement/i, "Gem"],
  [/nikkah|nikah|aqd|ceremony|vow|wedding/i, "Heart"],
  [/dance|dj\b|band|entertainment|performance/i, "Music"],
  [/dinner|lunch|breakfast|food|meal|dining|buffet|eat/i, "Utensils"],
  [/photo|photograph|camera|picture|portrait/i, "Camera"],
  [/cake|dessert|sweet|cutting/i, "Cake"],
  [/cocktail|drink|bar|wine|champagne|toast|alcohol/i, "Wine"],
  [/speech|mc\b|microphone|address/i, "Mic2"],
  [/firework|confetti|sparkle/i, "Sparkles"],
  [/flower|floral|bouquet/i, "Flower2"],
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
  [/outdoor|garden|park/i, "Sun"],
  [/crown|vip/i, "Crown"],
];

function guessIconFromTitle(title: string): string {
  for (const [re, icon] of KEYWORD_MAP) {
    if (re.test(title)) return icon;
  }
  return "CalendarDays";
}

function ItemIcon({ name, title }: { name?: string; title: string }) {
  const resolved = (name && ITINERARY_ICONS[name]) ? name : guessIconFromTitle(title);
  const Icon = ITINERARY_ICONS[resolved] ?? CalendarDays;
  return <Icon size={15} strokeWidth={1.6} aria-hidden />;
}

export function ItineraryTimeline({ items }: { items: ItineraryItem[] }) {
  if (!items.length) return null;

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fbf8f2]">
      {/* Header */}
      <div className="border-b border-[#ece4d4] px-5 py-5 text-center">
        <div
          className="mx-auto mb-3 h-px w-16 bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent"
          aria-hidden
        />
        <p className="text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          Schedule
        </p>
        <p className={`mt-1 text-base leading-snug text-zinc-800 ${serif}`}>
          Event Timeline
        </p>
      </div>

      {/* Items */}
      <div className="divide-y divide-[#ece4d4]">
        {items.map((item, i) => {
          const displayTime = getDisplayTime(item);
          return (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              {/* Icon bubble */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b28944]/10 text-[#b28944]">
                <ItemIcon name={item.icon} title={item.title} />
              </div>

              {/* Title */}
              <p className={`flex-1 text-sm font-semibold leading-snug text-zinc-900 ${serif}`}>
                {item.title}
              </p>

              {/* Time range */}
              {displayTime ? (
                <p className="shrink-0 text-right text-[0.7rem] font-medium leading-snug text-[#8b6a34]">
                  {displayTime.includes("–") ? (
                    <>
                      {displayTime.split("–")[0].trim()}
                      <br />
                      <span className="font-normal text-zinc-400">→ {displayTime.split("–")[1].trim()}</span>
                    </>
                  ) : (
                    displayTime
                  )}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
