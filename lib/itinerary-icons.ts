/** Curated schedule icons with plain labels, plus a local keyword guess (no network call). */
export const ITINERARY_ICON_OPTIONS = [
  { name: "CalendarDays", label: "General" },
  { name: "Heart", label: "Ceremony / Nikkah" },
  { name: "Gem", label: "Rings / engagement" },
  { name: "Flower2", label: "Mehndi / haldi / flowers" },
  { name: "PartyPopper", label: "Baraat / reception" },
  { name: "Music", label: "Music / dance" },
  { name: "Utensils", label: "Meal" },
  { name: "Cake", label: "Cake / dessert" },
  { name: "Wine", label: "Drinks / toast" },
  { name: "Coffee", label: "Tea / brunch" },
  { name: "Camera", label: "Photos" },
  { name: "Video", label: "Video" },
  { name: "Mic2", label: "Speeches" },
  { name: "BookOpen", label: "Prayer / reading" },
  { name: "Handshake", label: "Welcome" },
  { name: "MapPin", label: "Arrival / venue" },
  { name: "Car", label: "Transport" },
  { name: "Users", label: "Family gathering" },
  { name: "Gift", label: "Gifts" },
  { name: "Crown", label: "Bride / groom" },
  { name: "Sparkles", label: "Fireworks / sparklers" },
  { name: "Star", label: "Highlight" },
  { name: "Moon", label: "Evening" },
  { name: "Sun", label: "Outdoor" },
] as const;

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/baraat|barat/i, "PartyPopper"],
  [/haldi|mehndi|mehendi/i, "Flower2"],
  [/ring|gem|jewel|diamond|engagement/i, "Gem"],
  [/nikkah|nikah|aqd|vow|wedding|ceremony|pheras|anand karaj/i, "Heart"],
  [/dance|dj\b|band|sangeet|entertainment|performance/i, "Music"],
  [/dinner|lunch|breakfast|food|meal|dining|buffet|biryani/i, "Utensils"],
  [/photo|camera|picture|portrait/i, "Camera"],
  [/cake|dessert|sweet|cutting/i, "Cake"],
  [/cocktail|drink|\bbar\b|wine|champagne|toast/i, "Wine"],
  [/speech|\bmc\b|microphone|address/i, "Mic2"],
  [/firework|confetti|sparkle/i, "Sparkles"],
  [/flower|floral|bouquet/i, "Flower2"],
  [/video|film/i, "Video"],
  [/reception|party|celebration|walima|valima/i, "PartyPopper"],
  [/coffee|brunch|tea/i, "Coffee"],
  [/transport|shuttle|bus\b|transfer/i, "Car"],
  [/prayer|salah|namaz|dua|quran|reading/i, "BookOpen"],
  [/gift|present/i, "Gift"],
  [/welcome|greet/i, "Handshake"],
  [/arrival|venue|entrance/i, "MapPin"],
  [/family|group|gathering/i, "Users"],
  [/night|evening/i, "Moon"],
  [/outdoor|garden|lawn/i, "Sun"],
  [/vidaai|rukhsati|bride|groom/i, "Crown"],
];

export function guessItineraryIcon(title: string): string {
  const t = title.trim();
  for (const [re, icon] of KEYWORD_MAP) {
    if (re.test(t)) return icon;
  }
  return "CalendarDays";
}
