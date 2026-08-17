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
 * Small uppercase labels, matching the rest of the launch page.
 */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

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
      title="1 · Creatives + copy modelled on winning ads"
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <FieldLabel>Number of creatives</FieldLabel>
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
          <FieldLabel>Format</FieldLabel>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <FieldLabel>Resolution</FieldLabel>
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

      {/* Says which model actually runs, because the setting above promises a
          resolution and the model is what has to deliver it. */}
      <p className="text-xs text-muted-foreground">
        Images: OpenAI gpt-image-2 at 1024px. Larger sizes and other models are
        a one-line change once a plan allows them.
      </p>

      <label className="flex flex-col gap-1">
        <FieldLabel>
          Ad Library links (competitors or other niches with strong creative)
        </FieldLabel>
        <Textarea
          rows={3}
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          placeholder="Paste Ad Library links, one per line. Your new creatives are modelled on them — original, and written for your store."
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

      <p className="text-sm text-muted-foreground">
        …or paste the text of winning ads yourself:
      </p>

      <div>
        <label className="flex flex-col gap-1">
          <FieldLabel>Winning ads (text) — paste one or more</FieldLabel>
          <Textarea
            rows={4}
            value={winningText}
            onChange={(event) => setWinningText(event.target.value)}
            placeholder="Paste the text of winning ads. The generator models the new creatives and copy on these, but writes original wording."
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <FieldLabel>
          Product brief (empty = your store profile is used automatically)
        </FieldLabel>
        <Textarea
          rows={2}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Optional: extra product details and the offer to lead with…"
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
