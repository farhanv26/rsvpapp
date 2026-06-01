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

const FALLBACK_ICON = "CalendarDays";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();

  if (!title) {
    return NextResponse.json({ icon: FALLBACK_ICON });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ icon: FALLBACK_ICON });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content: `You are classifying a wedding/event schedule item into an icon. Given the item title below, pick the single best-matching icon name from this exact list:\n\n${ICON_NAMES.join(", ")}\n\nHints: prayer/salah/namaz → BookOpen, ring/nikkah/jewel → Gem or Heart, dessert/cake/sweet → Cake, dance/music/DJ → Music, dinner/food/buffet → Utensils.\n\nEvent item title: "${title}"\n\nRespond with ONLY the icon name, nothing else.`,
        },
      ],
    });

    const raw = (message.content[0] as { type: string; text: string })?.text?.trim() ?? "";
    const icon = ICON_NAMES.includes(raw as (typeof ICON_NAMES)[number]) ? raw : FALLBACK_ICON;
    return NextResponse.json({ icon });
  } catch {
    return NextResponse.json({ icon: FALLBACK_ICON });
  }
}
