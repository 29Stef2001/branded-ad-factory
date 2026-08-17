"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Trophy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DarkPanel } from "@/components/layout/dark-panel";
import {
  CREATIVE_COUNTS,
  CREATIVE_FORMATS,
  RESOLUTIONS,
  parseAdLibraryLinks,
} from "@/features/ad-launch/domain/creative-options";
import { generateFromWinnersAction } from "@/features/ad-launch/application/generate-from-winners";

/**
 * Creatives and copy modelled on ads that already work.
 *
 * Generation runs through the existing concept pipeline — brand context,
 * structured concepts, image generation, then QA — rather than a shortcut that
 * skips it. The QA pass is what stops an off-brand creative reaching an ad
 * account, and a second route around it would make that guarantee meaningless.
 *
 * Nothing is launched from here. Generated creatives land in the library and
 * are picked in block 4 like any other, because a creative that has not been
 * looked at should not be one click from spending money.
 */
export function GenerateCreatives() {
  const [count, setCount] = useState<number>(10);
  const [format, setFormat] = useState(CREATIVE_FORMATS[0].id);
  const [resolution, setResolution] = useState(RESOLUTIONS[0].id);
  const [links, setLinks] = useState("");
  const [winningText, setWinningText] = useState("");
  const [brief, setBrief] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, start] = useTransition();

  const parsedLinks = parseAdLibraryLinks(links);

  const run = (source: "links" | "text") =>
    start(async () => {
      setError(null);
      setMessage(null);

      const result = await generateFromWinnersAction({
        count,
        formatId: format,
        resolutionId: resolution,
        adLibraryLinks: source === "links" ? parsedLinks : [],
        winningAdText: source === "text" ? winningText : "",
        productBrief: brief,
      });

      if (result.error) setError(result.error);
      else setMessage(result.message);
    });

  return (
    <DarkPanel
      title="1 · Creatives and copy from winning ads"
      description="Modelled on ads that already work, written for your store. Runs through the same QA as everything else, so nothing off-brand reaches an ad account."
      actions={
        <Link
          href="/dashboard/concepts"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          See all concepts
        </Link>
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Number of creatives</span>
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {CREATIVE_COUNTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {CREATIVE_FORMATS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Resolution</span>
          <select
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {RESOLUTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">
          Ad Library links — competitors in other niches with strong creative
        </span>
        <Textarea
          rows={3}
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          placeholder="https://www.facebook.com/ads/library/?id=…  (one per line)"
          className="font-mono text-[13px]"
        />
        <span className="text-xs text-muted-foreground">
          {links.trim() && parsedLinks.length === 0
            ? "No Ad Library links found — they look like facebook.com/ads/library/?id=…"
            : `${parsedLinks.length} link${parsedLinks.length === 1 ? "" : "s"} recognised.`}
        </span>
      </label>

      <Button
        type="button"
        size="sm"
        disabled={running || parsedLinks.length === 0}
        onClick={() => run("links")}
      >
        <Trophy aria-hidden className="size-3.5" />
        {running ? "Generating…" : "Scan links and generate for my store"}
      </Button>

      <div className="border-t border-border pt-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">
            …or paste the text of winning ads
          </span>
          <Textarea
            rows={4}
            value={winningText}
            onChange={(event) => setWinningText(event.target.value)}
            placeholder="Paste one or more ads. They are modelled on, not copied — the wording written will be your own."
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">
          Product brief — optional, your store profile is used when empty
        </span>
        <Textarea
          rows={2}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Extra product details or the offer to lead with…"
        />
      </label>

      <Button
        type="button"
        size="sm"
        disabled={running || winningText.trim().length === 0}
        onClick={() => run("text")}
      >
        <Sparkles aria-hidden className="size-3.5" />
        {running ? "Generating…" : "Generate from these winners"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && <p className="text-sm text-success">{message}</p>}
    </DarkPanel>
  );
}
