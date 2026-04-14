import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SafeEventImage } from "@/components/safe-event-image";
import { getSafeImageSrc } from "@/lib/utils";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe("Phase 1 - image path and rendering safety", () => {
  it("accepts browser-safe image paths", () => {
    expect(getSafeImageSrc("/uploads/invite.png")).toBe("/uploads/invite.png");
    expect(getSafeImageSrc("https://abc.public.blob.vercel-storage.com/invite.png")).toBe(
      "https://abc.public.blob.vercel-storage.com/invite.png",
    );
  });

  it("rejects filesystem and malformed paths", () => {
    expect(getSafeImageSrc("public/uploads/invite.png")).toBeNull();
    expect(getSafeImageSrc("C:\\uploads\\invite.png")).toBeNull();
    expect(getSafeImageSrc("")).toBeNull();
    expect(getSafeImageSrc(null)).toBeNull();
  });

  it("shows fallback if image load fails", () => {
    render(
      <div style={{ width: 300, height: 200 }}>
        <SafeEventImage
          src="/uploads/broken.png"
          alt="Invite"
          fallbackLabel="Invitation image unavailable"
          width={300}
          height={200}
        />
      </div>,
    );

    const img = screen.getByAltText("Invite");
    fireEvent.error(img);
    expect(screen.getByText("Invitation image unavailable")).toBeInTheDocument();
  });
});
