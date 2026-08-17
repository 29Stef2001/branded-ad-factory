"use client";

import { useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Images,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { mediaKindFor } from "@/features/ad-launch/domain/media";
import { uploadLaunchMediaAction } from "@/features/ad-launch/application/launch-batch";

export type ImageEntry = {
  url: string;
  /**
   * Copy for this one ad, when it should differ from the shared block.
   *
   * Null is the normal case — the whole point of the shared block is that
   * these are almost always identical. An override exists because "almost" is
   * not "always": one creative in a batch sometimes needs its own headline,
   * and the alternative is launching it separately.
   */
  overrideHeadline: string | null;
  overridePrimaryText: string | null;
};

/**
 * The images in a batch, in order. One ad each.
 *
 * Every ad in an ad set carries the same copy — only the picture changes — so
 * the batch is a list of images against one block of text, not a list of ads
 * each repeating the same words. Building it the other way meant retyping the
 * same headline thirty times, or forgetting to on the thirty-first.
 *
 * Order is kept and adjustable because it decides the ad numbering, and people
 * paste creatives in the sequence they think about them.
 */
export function ImageList({
  images,
  onChange,
}: {
  images: ImageEntry[];
  onChange: (next: ImageEntry[]) => void;
}) {
  const [pasted, setPasted] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const addUrls = (urls: string[]) => {
    // Duplicates are dropped: the same creative twice in one ad set competes
    // with itself for delivery.
    const known = new Set(images.map((image) => image.url));
    onChange([
      ...images,
      ...urls
        .filter((url) => !known.has(url))
        .map((url) => ({
          url,
          overrideHeadline: null,
          overridePrimaryText: null,
        })),
    ]);
  };

  const parsed = pasted
    .split(/[\n,\s]+/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <span className="text-sm font-medium">Upload from your computer</span>
        <p className="text-xs text-muted-foreground">
          Images or videos. Pick several at once — each becomes its own ad, in
          the order you selected them.
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;

            setUploadError(null);
            const body = new FormData();
            for (const file of files) body.append("files", file);

            startUpload(async () => {
              const result = await uploadLaunchMediaAction(body);
              // Whatever got through is added even when a later file failed —
              // re-uploading twenty because the nineteenth broke is its own
              // problem.
              if (result.urls.length > 0) addUrls(result.urls);
              setUploadError(result.error);
              if (fileInput.current) fileInput.current.value = "";
            });
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden className="size-3.5" />
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
        {uploadError && (
          <span className="text-xs text-destructive">{uploadError}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <span className="text-sm font-medium">…or paste creative URLs</span>
        <p className="text-xs text-muted-foreground">
          One per line — images or videos. Each becomes its own ad, in this
          order, sharing the copy above.
        </p>
        <Textarea
          rows={4}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder={"https://…/creative-01.png\nhttps://…/creative-02.png"}
          className="font-mono text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={parsed.length === 0}
            onClick={() => {
              addUrls(parsed);
              setPasted("");
            }}
          >
            <Images aria-hidden className="size-3.5" />
            Add {parsed.length || ""} image{parsed.length === 1 ? "" : "s"}
          </Button>
          {pasted.trim() && parsed.length === 0 && (
            <span className="text-xs text-destructive">
              No usable URLs — each line must start with http:// or https://
            </span>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {images.map((image, index) => (
            <div
              key={image.url}
              className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                {mediaKindFor(image.url) === "video" ? (
                  <video
                    src={image.url}
                    muted
                    className="size-12 shrink-0 rounded object-cover ring-1 ring-foreground/10"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL
                  <img
                    src={image.url}
                    alt=""
                    className="size-12 shrink-0 rounded object-cover ring-1 ring-foreground/10"
                  />
                )}
                <span className="min-w-40 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {image.url}
                  {mediaKindFor(image.url) === "unknown" && (
                    // Meta needs to know before uploading: videos and images go
                    // to different endpoints entirely.
                    <span className="ml-2 text-warning">
                      unrecognised file type — will be uploaded as an image
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label="Move up"
                  >
                    <ArrowUp aria-hidden className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown aria-hidden className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      image.overrideHeadline || image.overridePrimaryText
                        ? "default"
                        : "ghost"
                    }
                    onClick={() =>
                      setEditing(editing === image.url ? null : image.url)
                    }
                    aria-label="Different copy for this ad"
                    title="Different copy for this ad"
                  >
                    <Pencil aria-hidden className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onChange(
                        images.filter((_, position) => position !== index),
                      )
                    }
                    aria-label="Remove"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </div>
              </div>

              {editing === image.url && (
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the shared copy. Only fill these in when
                    this one ad needs different words.
                  </p>
                  <Input
                    value={image.overrideHeadline ?? ""}
                    onChange={(event) =>
                      onChange(
                        images.map((entry, position) =>
                          position === index
                            ? {
                                ...entry,
                                overrideHeadline: event.target.value || null,
                              }
                            : entry,
                        ),
                      )
                    }
                    placeholder="Headline for this ad only"
                  />
                  <Textarea
                    rows={2}
                    value={image.overridePrimaryText ?? ""}
                    onChange={(event) =>
                      onChange(
                        images.map((entry, position) =>
                          position === index
                            ? {
                                ...entry,
                                overridePrimaryText: event.target.value || null,
                              }
                            : entry,
                        ),
                      )
                    }
                    placeholder="Primary text for this ad only"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
