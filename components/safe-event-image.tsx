"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  fallbackLabel?: string;
};

export function SafeEventImage({
  src,
  alt,
  className,
  sizes,
  priority,
  fill,
  width,
  height,
  fallbackLabel = "Invitation image unavailable",
}: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f7f1e8] text-sm text-zinc-500">
        {fallbackLabel}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      priority={priority}
      fill={fill}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}
