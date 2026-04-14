"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  value: string;
};

export function CopyLinkButton({ value }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition active:scale-[0.98]"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
