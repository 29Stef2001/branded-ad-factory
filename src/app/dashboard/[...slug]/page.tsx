import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonState } from "@/components/layout/coming-soon-state";
import { PageHeader } from "@/components/layout/page-header";
import { findLeafBySegment } from "@/components/shell/nav-config";

/**
 * One placeholder route serving every not-yet-built module, instead of ~25
 * near-identical page files. Next.js gives static segments precedence over a
 * catch-all, so every real page (/dashboard/concepts, /dashboard/competitors/[id],
 * …) still resolves to its own implementation and never reaches this file.
 *
 * Only paths listed in NAV_TREE as "soon" render here — anything else 404s, so a
 * mistyped URL doesn't masquerade as an unbuilt feature.
 */
type Params = { slug: string[] };

function placeholderFor(slug: string[]) {
  const leaf = findLeafBySegment(slug.join("/"));
  return leaf?.status === "soon" ? leaf : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const item = placeholderFor((await params).slug);
  return {
    title: item
      ? `${item.label} — Branded Ad Factory`
      : "Not found — Branded Ad Factory",
  };
}

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const item = placeholderFor((await params).slug);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Module" title={item.label} />
      <ComingSoonState title={item.label} blurb={item.blurb} />
    </div>
  );
}
