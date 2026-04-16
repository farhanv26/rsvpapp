import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { resolveRsvpPreviewCardSource, toAbsolutePreviewUrl } from "@/lib/rsvp-share-preview";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await prisma.guest.findUnique({
    where: { token },
    select: {
      maxGuests: true,
      isFamilyInvite: true,
      event: {
        select: {
          title: true,
          coupleNames: true,
          imagePath: true,
          genericCardImage: true,
          cardImage1: true,
          cardImage2: true,
          cardImage3: true,
          cardImage4: true,
          familyCardImage: true,
        },
      },
    },
  });

  const previewSource = guest
    ? resolveRsvpPreviewCardSource(
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
      )
    : null;
  const absoluteCardSrc = toAbsolutePreviewUrl(previewSource?.chosenRawSrc ?? null);
  const title = guest?.event.coupleNames?.trim() || guest?.event.title || "RSVP Invitation";
  console.info("[rsvp:opengraph-image] render", {
    token,
    hasGuest: Boolean(guest),
    sourceUsed: previewSource?.resolvedVariantSource ?? "none",
    sourceCard: previewSource?.chosenRawSrc ?? null,
    absoluteCardSrc,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f9f2e6 0%, #efe3d0 50%, #eadcc8 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.32,
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6), transparent 42%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.5), transparent 40%)",
          }}
        />
        {absoluteCardSrc ? (
          <div
            style={{
              width: 340,
              height: 510,
              borderRadius: 18,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fffdf9",
              boxShadow: "0 28px 70px rgba(52, 37, 19, 0.28)",
              border: "1px solid rgba(180, 150, 110, 0.45)",
            }}
          >
            <img src={absoluteCardSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : (
          <div
            style={{
              width: 760,
              height: 420,
              borderRadius: 20,
              border: "1px solid rgba(180, 150, 110, 0.45)",
              background: "rgba(255,255,255,0.68)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5b4a35",
              fontSize: 56,
              fontWeight: 600,
            }}
          >
            {title}
          </div>
        )}
      </div>
    ),
    size,
  );
}

