"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CALL_TO_ACTIONS } from "@/features/ad-launch/domain/campaign-settings";

export type AdDraft = {
  id: string;
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  linkUrl: string;
  imageUrl: string;
  conceptId: string | null;
};

/** Meta's own limits. Longer text is truncated in the feed, not rejected. */
const LIMITS = { primaryText: 125, headline: 40, description: 30 } as const;

function CharacterCount({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return (
    <span
      className={
        over ? "text-xs text-warning" : "text-xs text-muted-foreground/70"
      }
    >
      {value.length}/{limit}
      {/* Over the limit is a warning rather than an error: Meta accepts it and
          truncates in the feed, so blocking the launch would be stricter than
          Meta itself. */}
      {over ? " — will be truncated" : ""}
    </span>
  );
}

export function AdFields({
  ad,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  ad: AdDraft;
  index: number;
  onChange: (id: string, patch: Partial<AdDraft>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const set = (patch: Partial<AdDraft>) => onChange(ad.id, patch);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Ad {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(ad.id)}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </Button>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2 text-xs font-medium">
          Primary text
          <CharacterCount value={ad.primaryText} limit={LIMITS.primaryText} />
        </span>
        <Textarea
          rows={3}
          value={ad.primaryText}
          onChange={(event) => set({ primaryText: event.target.value })}
          placeholder="The body copy above the image."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-xs font-medium">
            Headline
            <CharacterCount value={ad.headline} limit={LIMITS.headline} />
          </span>
          <Input
            value={ad.headline}
            onChange={(event) => set({ headline: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-xs font-medium">
            Description
            <CharacterCount value={ad.description} limit={LIMITS.description} />
          </span>
          <Input
            value={ad.description}
            onChange={(event) => set({ description: event.target.value })}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Call to action</span>
          <select
            value={ad.callToAction}
            onChange={(event) => set({ callToAction: event.target.value })}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {CALL_TO_ACTIONS.map((cta) => (
              <option key={cta} value={cta}>
                {cta.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Destination URL</span>
          <Input
            type="url"
            value={ad.linkUrl}
            onChange={(event) => set({ linkUrl: event.target.value })}
            placeholder="https://…"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Image URL</span>
        <Input
          type="url"
          value={ad.imageUrl}
          onChange={(event) => set({ imageUrl: event.target.value })}
          placeholder="https://…"
        />
      </label>

      {ad.imageUrl && /^https?:\/\//i.test(ad.imageUrl) && (
        // Shown because a wrong image is the one mistake this form cannot
        // catch by validation — the URL is perfectly valid and the picture is
        // simply not the one meant.
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL
        <img
          src={ad.imageUrl}
          alt=""
          className="size-20 rounded-md object-cover ring-1 ring-foreground/10"
        />
      )}
    </div>
  );
}
