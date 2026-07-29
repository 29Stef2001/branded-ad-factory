"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The concept's attribution code, with one click to copy it.
 *
 * This is the whole deterministic half of attribution: paste this into the Meta
 * ad's name and performance data finds its way back to this concept exactly,
 * with no image matching and nothing to confirm. It is shown on the card rather
 * than buried in a detail view because it is only useful at the moment someone
 * is about to create the ad.
 */
export function ConceptCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Copy — paste this into the Meta ad name to link its performance back here"
      onClick={() => {
        navigator.clipboard
          .writeText(code)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {code}
      {copied ? (
        <Check aria-hidden className="size-3 text-success" />
      ) : (
        <Copy aria-hidden className="size-3" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy concept code"}</span>
    </button>
  );
}
