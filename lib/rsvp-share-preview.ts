import { resolveInviteCardImage, type InviteCardEventInput } from "@/lib/invite-card-resolution";
import { getPublicSiteUrl, getSafeImageSrc } from "@/lib/utils";

type GuestImageInput = {
  maxGuests: number;
  isFamilyInvite: boolean;
};

export function resolveRsvpPreviewCardSource(event: InviteCardEventInput, guest: GuestImageInput) {
  const resolved = resolveInviteCardImage(event, guest);
  const resolvedVariantSrc = getSafeImageSrc(resolved.rawPath);
  const defaultMainSrc = getSafeImageSrc(event.imagePath);
  const genericFallbackSrc = getSafeImageSrc(event.genericCardImage);
  const chosenRawSrc = resolvedVariantSrc ?? defaultMainSrc ?? genericFallbackSrc;
  return {
    resolvedVariantSource: resolved.source,
    resolvedVariantSrc,
    defaultMainSrc,
    genericFallbackSrc,
    chosenRawSrc,
  };
}

export function toAbsolutePreviewUrl(src: string | null | undefined) {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const base = getPublicSiteUrl();
  if (!base) return null;
  return `${base}${src}`;
}

export function buildRsvpOgRouteUrl(token: string, version: number | string) {
  const base = getPublicSiteUrl();
  if (!base) return null;
  return `${base}/rsvp/${token}/opengraph-image?v=${encodeURIComponent(String(version))}`;
}

