"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/shell/sidebar-nav";

/**
 * Below `lg` the sidebar becomes a drawer. `identity` and `footer` are passed in
 * as rendered nodes so this client component can host the server-rendered
 * workspace header and the logout Server Action form without either becoming a
 * client component itself.
 */
export function MobileNav({
  identity,
  footer,
}: {
  identity: ReactNode;
  footer: ReactNode;
}) {
  // No mount guard is needed to keep `document` off the server: `open` starts
  // false, so the portal cannot render until a click has happened in the browser.
  const [open, setOpen] = useState(false);

  // A drawer that outlives its own scroll lock leaves the page stuck, so the
  // lock is tied directly to `open` and always released on unmount.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden className="size-4" />
      </Button>

      {/* Portalled to <body> on purpose. The mobile header that renders this
          button uses `backdrop-blur`, and a backdrop-filter establishes a
          containing block for fixed-position descendants — inline, the drawer's
          `fixed inset-0` resolved to the ~100px header box instead of the
          viewport, leaving it clipped and transparent. The portal puts it beyond
          the reach of any ancestor's filter, transform or contain. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/70"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard navigation"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
            >
              <div className="relative">
                {identity}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                  className="absolute top-2 right-2"
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
              <div className="border-t border-sidebar-border px-3 py-2">
                {footer}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
