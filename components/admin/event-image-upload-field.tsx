"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { EVENT_IMAGE_MAX_SIZE_LABEL, validateEventImageFile } from "@/lib/event-image";
import { getSafeImageSrc } from "@/lib/utils";
import { SafeEventImage } from "@/components/safe-event-image";

type Props = {
  initialImagePath?: string | null;
  inputName?: string;
};

export function EventImageUploadField({ initialImagePath = null, inputName = "imagePath" }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(initialImagePath);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationError = validateEventImageFile(file);
    if (validationError) {
      setError(validationError);
      setUploadedPath(initialImagePath);
      event.target.value = "";
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set("image", file);

      const response = await fetch("/admin/api/event-image", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as { imagePath?: string; error?: string };
      if (!response.ok || !payload.imagePath) {
        throw new Error(payload.error || "Image upload failed.");
      }
      setUploadedPath(payload.imagePath);
    } catch (uploadError) {
      setUploadedPath(initialImagePath);
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  const safeImageSrc = getSafeImageSrc(uploadedPath);
  const hasImage = Boolean(safeImageSrc);

  return (
    <div className="space-y-4">
      <input type="hidden" name={inputName} value={uploadedPath ?? ""} />
      <div className="rounded-2xl border border-dashed border-[#dccfbb] bg-[#fffdfa] p-4">
        <label htmlFor="image" className="mb-2 block text-sm font-semibold text-zinc-800">
          Invitation image
        </label>
        <p className="mb-3 text-xs text-zinc-600">PNG or JPG formats are supported.</p>
        <input
          ref={fileInputRef}
          id="image"
          name="image"
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          onChange={onFileChange}
          disabled={isUploading}
          className="w-full rounded-2xl border border-[#dccfbb] bg-white px-4 py-3 text-base file:mr-3 file:rounded-xl file:border-0 file:bg-[#efe3d2] file:px-3 file:py-2 file:text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-3 text-xs text-zinc-500">
          Max file size {EVENT_IMAGE_MAX_SIZE_LABEL}. Larger files should be compressed before upload.
        </p>
      </div>

      {isUploading ? <p className="text-sm text-zinc-600">Uploading image...</p> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {!error && uploadedPath ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Image uploaded. It will be attached when you save this event.
        </div>
      ) : null}

      {hasImage ? (
        <div className="rounded-2xl border border-[#e3d8c7] bg-[#f7f2e9] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</p>
            <button
              type="button"
              onClick={() => {
                setUploadedPath(null);
                setError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              Remove image
            </button>
          </div>
          <div className="relative h-52 w-full overflow-hidden rounded-xl border border-[#e7dccb] bg-[#fffdfa]">
            <SafeEventImage
              src={safeImageSrc ?? ""}
              alt="Invitation preview"
              fill
              className="object-contain object-center"
              fallbackLabel="Invitation image unavailable"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
