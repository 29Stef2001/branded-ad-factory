import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ANTHROPIC_API_KEY: z.string().min(1),
    META_AD_LIBRARY_ACCESS_TOKEN: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_APP_SECRET: z.string().min(1),
    META_LOGIN_CONFIG_ID: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    // Optional: extends the product-photo-URL allowlist in generate-creative-image.ts
    // beyond Shopify's own domains, for stores serving CDN assets on a custom domain
    // (e.g. copper-soul.com/cdn/shop/... rather than cdn.shopify.com/...).
    SHOPIFY_STORE_HOSTNAME: z.string().min(1).optional(),
    // Shared secret the Creative Intelligence cron handlers authenticate with.
    // Optional so local development runs without it; the handler refuses to do
    // anything when it is unset, rather than defaulting to open.
    CRON_SECRET: z.string().min(16).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    META_AD_LIBRARY_ACCESS_TOKEN: process.env.META_AD_LIBRARY_ACCESS_TOKEN,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_LOGIN_CONFIG_ID: process.env.META_LOGIN_CONFIG_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SHOPIFY_STORE_HOSTNAME: process.env.SHOPIFY_STORE_HOSTNAME,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
});
