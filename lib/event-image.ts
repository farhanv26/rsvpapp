export const EVENT_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const EVENT_IMAGE_MAX_SIZE_LABEL = "10MB";
export const EVENT_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg"] as const;

export function validateEventImageFile(file: File) {
  if (!EVENT_IMAGE_ALLOWED_TYPES.includes(file.type as (typeof EVENT_IMAGE_ALLOWED_TYPES)[number])) {
    return "Image must be PNG or JPG/JPEG.";
  }
  if (file.size > EVENT_IMAGE_MAX_SIZE_BYTES) {
    return `Image is too large. Please choose a PNG or JPG under ${EVENT_IMAGE_MAX_SIZE_LABEL}.`;
  }
  return null;
}
