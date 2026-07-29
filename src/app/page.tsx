import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Branded Ad Factory
      </h1>
      <p className="max-w-xl text-muted-foreground">
        Analyze competitor ads and generate on-brand ad concepts for your
        e-commerce brand.
      </p>
      <div className="flex items-center gap-3">
        {/* buttonVariants on a Link, as everywhere else in the app. Passing a
            Link through Button's `render` prop makes it an <a> while Base UI
            still expects a native <button>, which warns and drops button
            semantics. */}
        <Link href="/register" className={buttonVariants()}>
          Get started
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Log in
        </Link>
      </div>
    </main>
  );
}
