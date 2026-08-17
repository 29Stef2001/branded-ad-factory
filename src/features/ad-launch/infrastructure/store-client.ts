/**
 * Reading a Shopify store from its public endpoints.
 *
 * Shopify serves `/products.json` and `/meta.json` to anyone, so a store can be
 * read without an API key, an app install or the merchant granting anything.
 * That matters here: the point is to type a URL once and have the products be
 * real, rather than describing them from memory and having the generator
 * invent items the shop does not sell.
 */

export type StoreProduct = {
  title: string;
  description: string;
  price: string | null;
  imageUrl: string | null;
  productUrl: string;
  productType: string | null;
};

export type StoreSnapshot = {
  storeName: string | null;
  /** What it sells, derived from the product types actually listed. */
  sells: string | null;
  products: StoreProduct[];
};

export class StoreFetchError extends Error {}

/** Trims a pasted address to its origin, so a deep link still works. */
export function normaliseStoreUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    throw new StoreFetchError("That does not look like a web address.");
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

type RawProduct = {
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  images?: { src?: string }[];
  variants?: { price?: string }[];
};

/**
 * Fetches the products a store actually lists.
 *
 * Paginates because `/products.json` caps at 250 and a shop can have more —
 * and a truncated catalogue is worse than an obvious failure, since it looks
 * complete while quietly missing the item someone wanted.
 */
export async function fetchStoreProducts(
  storeUrl: string,
  limit = 100,
): Promise<StoreProduct[]> {
  const origin = normaliseStoreUrl(storeUrl);
  const products: StoreProduct[] = [];
  const perPage = Math.min(250, limit);

  for (let page = 1; products.length < limit; page++) {
    const response = await fetch(
      `${origin}/products.json?limit=${perPage}&page=${page}`,
      { headers: { accept: "application/json" } },
    );

    if (!response.ok) {
      throw new StoreFetchError(
        page === 1
          ? `The store did not return a product list (HTTP ${response.status}). This works for Shopify stores; others need the images added by hand.`
          : `Stopped after ${products.length} products (HTTP ${response.status}).`,
      );
    }

    let body: { products?: RawProduct[] };
    try {
      body = await response.json();
    } catch {
      throw new StoreFetchError(
        "The store replied with something that is not a product list. This works for Shopify stores.",
      );
    }

    const batch = body.products ?? [];
    if (batch.length === 0) break;

    for (const product of batch) {
      if (products.length >= limit) break;
      const handle = product.handle ?? "";
      products.push({
        title: product.title ?? "Untitled",
        description: stripHtml(product.body_html ?? "").slice(0, 400),
        // Shopify reports price per variant; the first is the one shown.
        price: product.variants?.[0]?.price ?? null,
        imageUrl: product.images?.[0]?.src ?? null,
        productUrl: handle ? `${origin}/products/${handle}` : origin,
        productType: product.product_type || null,
      });
    }

    if (batch.length < perPage) break;
  }

  return products;
}

/**
 * A first look at a store: its name and what it sells.
 *
 * "Sells" is built from the product types the shop itself uses rather than
 * guessed from the domain — it is the shop's own words for its catalogue, and
 * it is what the copy will be written against.
 */
export async function fetchStoreSnapshot(
  storeUrl: string,
): Promise<StoreSnapshot> {
  const origin = normaliseStoreUrl(storeUrl);
  const products = await fetchStoreProducts(origin, 60);

  let storeName: string | null = null;
  try {
    const response = await fetch(`${origin}/meta.json`, {
      headers: { accept: "application/json" },
    });
    if (response.ok) {
      const meta = await response.json();
      storeName = meta?.name ?? null;
    }
  } catch {
    // meta.json is not always served. The hostname is a reasonable fallback
    // and the user can correct it — an empty field would be worse.
  }

  if (!storeName) {
    storeName = new URL(origin).hostname
      .replace(/^www\./, "")
      .replace(/\.[a-z.]+$/, "")
      .split(/[-_.]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  const types = [
    ...new Set(
      products
        .map((product) => product.productType)
        .filter((type): type is string => Boolean(type)),
    ),
  ];

  return {
    storeName,
    sells: types.length > 0 ? types.slice(0, 6).join(", ") : null,
    products,
  };
}
