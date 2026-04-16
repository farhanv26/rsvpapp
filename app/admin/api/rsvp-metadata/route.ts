import { NextResponse } from "next/server";
import { getCurrentAdminUserFromApi } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { resolveInviteCardImage } from "@/lib/invite-card-resolution";
import { getPublicSiteUrl, getSafeImageSrc } from "@/lib/utils";

export async function GET(request: Request) {
  const admin = await getCurrentAdminUserFromApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const guest = await prisma.guest.findUnique({
    where: { token },
    select: {
      guestName: true,
      maxGuests: true,
      isFamilyInvite: true,
      event: {
        select: {
          id: true,
          title: true,
          coupleNames: true,
          imagePath: true,
          genericCardImage: true,
          cardImage1: true,
          cardImage2: true,
          cardImage3: true,
          cardImage4: true,
          familyCardImage: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "Guest not found for token" }, { status: 404 });
  }

  const resolved = resolveInviteCardImage(
    {
      imagePath: guest.event.imagePath,
      genericCardImage: guest.event.genericCardImage,
      cardImage1: guest.event.cardImage1,
      cardImage2: guest.event.cardImage2,
      cardImage3: guest.event.cardImage3,
      cardImage4: guest.event.cardImage4,
      familyCardImage: guest.event.familyCardImage,
    },
    { maxGuests: guest.maxGuests, isFamilyInvite: guest.isFamilyInvite },
  );

  const resolvedVariantSrc = getSafeImageSrc(resolved.rawPath);
  const defaultMainSrc = getSafeImageSrc(guest.event.imagePath);
  const genericFallbackSrc = getSafeImageSrc(guest.event.genericCardImage);
  const chosenSrc = resolvedVariantSrc ?? defaultMainSrc ?? genericFallbackSrc;

  const base = getPublicSiteUrl();
  const canonical = base ? `${base}/rsvp/${token}` : null;
  const absoluteImageBase = !chosenSrc
    ? null
    : chosenSrc.startsWith("http://") || chosenSrc.startsWith("https://")
      ? chosenSrc
      : base
        ? `${base}${chosenSrc}`
        : null;
  const absoluteImage = absoluteImageBase
    ? `${absoluteImageBase}${absoluteImageBase.includes("?") ? "&" : "?"}v=${guest.event.updatedAt.getTime()}`
    : null;

  const names = guest.event.coupleNames?.trim() || guest.event.title;
  const title = `${names} · RSVP Invitation`;
  const description = `You are invited to ${guest.event.title}. Please RSVP through this private invitation link.`;

  return NextResponse.json({
    token,
    eventId: guest.event.id,
    guestName: guest.guestName,
    baseResolved: Boolean(base),
    canonical,
    title,
    description,
    og: {
      image: absoluteImage,
    },
    selection: {
      resolvedVariantSource: resolved.source,
      resolvedVariantSrc,
      defaultMainSrc,
      genericFallbackSrc,
      chosen: absoluteImage,
    },
  });
}

