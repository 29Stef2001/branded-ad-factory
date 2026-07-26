import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Branded Ad Factory
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
