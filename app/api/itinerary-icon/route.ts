import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const ICON_NAMES = [
  "BookOpen",
  "Cake",
  "CalendarDays",
  "Camera",
  "Car",
  "Coffee",
  "Crown",
  "Flower2",
  "Gem",
  "Gift",
  "Handshake",
  "Heart",
  "MapPin",
  "Mic2",
  "Moon",
  "Music",
  "PartyPopper",
  "Sparkles",
  "Star",
  "Sun",
  "Users",
  "Utensils",
  "Video",
  "Wine",
] as const;

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/baraat|barat/i, "PartyPopper"],
  [/haldi|mehndi|mehendi/i, "Flower2"],
  [/ring|gem|jewel|diamond|engagement/i, "Gem"],
  [/nikkah|nikah|aqd|vow|wedding/i, "Heart"],
  [/ceremony/i, "Heart"],
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
  [/crown|vip|groom|bride/i, "Crown"],
];

function guessIconFromTitle(title: string): string {
  for (const [re, icon] of KEYWORD_MAP) {
    if (re.test(title)) return icon;
  }
  // Try individual words as a last resort
  const words = title.toLowerCase().split(/\s+/);
  for (const word of words) {
    for (const [re, icon] of KEYWORD_MAP) {
      if (re.test(word)) return icon;
    }
  }
  return "CalendarDays";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();

  if (!title) {
    return NextResponse.json({ icon: guessIconFromTitle("") });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ icon: guessIconFromTitle(title) });
  }

  const iconList = ICON_NAMES.join(", ");
  const prompt = `You are classifying a wedding/event schedule item into an icon. For the title below, identify the most meaningful keyword, then pick the best-matching icon from this exact list:

${iconList}

Key mappings:
- prayer / salah / namaz / dua / quran / reading → BookOpen
- ring / nikkah / nikah / aqd / ceremony / vow / wedding → Heart
- engagement / jewel / diamond → Gem
- dance / dj / band / music / entertainment / performance → Music
- dinner / lunch / breakfast / food / meal / buffet / eat / biryani → Utensils
- cake / dessert / sweet / cutting → Cake
- photo / camera / portrait / picture → Camera
- speech / mc / microphone / address → Mic2
- cocktail / wine / bar / drink / champagne / toast → Wine
- reception / party / celebration / baraat / barat → PartyPopper
- transport / shuttle / bus / car / transfer → Car
- welcome / arrival / entrance / venue / location → MapPin
- family / group / gathering → Users
- gift / present / favor → Gift
- flower / floral / bouquet / haldi → Flower2
- video / film / cinema → Video
- night / evening / moon / dusk → Moon
- outdoor / garden / park / sun / lawn → Sun
- coffee / tea / brunch → Coffee
- crown / vip / groom / bride → Crown
- star / highlight / special → Star
- sparkle / firework / confetti → Sparkles
- handshake / meeting / greeting → Handshake

If the title has multiple words, focus on the most event-specific word.

Title: "${title}"

Reply with ONLY the icon name from the list above, nothing else.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string })?.text?.trim().replace(/[^A-Za-z0-9]/g, "") ?? "";
    const aiIcon = ICON_NAMES.includes(raw as (typeof ICON_NAMES)[number]) ? raw : null;
    // If AI returned CalendarDays (generic fallback), try keyword map for a more specific icon
    if (!aiIcon || aiIcon === "CalendarDays") {
      return NextResponse.json({ icon: guessIconFromTitle(title) });
    }
    return NextResponse.json({ icon: aiIcon });
  } catch {
    return NextResponse.json({ icon: guessIconFromTitle(title) });
  }
}
