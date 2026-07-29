"use client";

/**
 * Last resort: an error thrown by the root layout itself, before the dashboard
 * boundary exists to catch it.
 *
 * This one replaces <html> and <body>, so it cannot use the app's components or
 * layout — none of that has mounted. Deliberately plain, with its own inline
 * styling, because reaching for a stylesheet here is how a crash screen crashes.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0b",
          color: "#e8e8ea",
        }}
      >
        <main
          style={{ maxWidth: "26rem", padding: "2rem", textAlign: "center" }}
        >
          <h1 style={{ fontSize: "1.125rem", margin: "0 0 0.5rem" }}>
            The app failed to start
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#a1a1aa",
              margin: "0 0 1.5rem",
            }}
          >
            Something went wrong before the page could load.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              borderRadius: "0.375rem",
              border: "1px solid #2a2a2e",
              background: "#7c5cff",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
