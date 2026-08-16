"use client";

import { useState } from "react";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Turns a list of image URLs into one ad each, in the order given.
 *
 * Adding thirty ads one at a time is thirty clicks before any copy is typed,
 * and these ad sets hold thirty creatives by design. Order is preserved
 * because it is meaningful: people paste them in the sequence they want them
 * numbered.
 */
export function BulkImages({
  onAdd,
}: {
  onAdd: (imageUrls: string[]) => void;
}) {
  const [text, setText] = useState("");

  const urls = text
    .split(/[\n,\s]+/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <span className="text-sm font-medium">Add several images at once</span>
      <p className="text-xs text-muted-foreground">
        One URL per line. Each becomes its own ad, in this order — you fill in
        the copy afterwards.
      </p>
      <Textarea
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"https://…/creative-01.png\nhttps://…/creative-02.png"}
        className="font-mono text-[13px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={urls.length === 0}
          onClick={() => {
            onAdd(urls);
            setText("");
          }}
        >
          <Images aria-hidden className="size-3.5" />
          Add {urls.length || ""} ad{urls.length === 1 ? "" : "s"}
        </Button>
        {text.trim() && urls.length === 0 && (
          <span className="text-xs text-destructive">
            No usable URLs — each line must start with http:// or https://
          </span>
        )}
      </div>
    </div>
  );
}
