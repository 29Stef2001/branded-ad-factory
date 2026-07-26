import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button render={<Link href="/register">Get started</Link>} />
        <Button variant="outline" render={<Link href="/login">Log in</Link>} />
      </div>
    </main>
  );
}
