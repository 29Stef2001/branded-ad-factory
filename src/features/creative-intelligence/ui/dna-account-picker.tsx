"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export type PickerAccount = {
  id: string;
  label: string;
  eligible: number;
  status: string | null;
};

/**
 * Which accounts' patterns are being read, as a dropdown of checkboxes.
 *
 * A dropdown rather than a row of buttons because there are 44 of them: laid
 * out flat they push the analyse button off the screen, and the thing you came
 * to press should not be below the thing you came to choose.
 *
 * Every account is listed, including ones with nothing to read yet. An account
 * with no eligible creatives today has some tomorrow, and a picker that quietly
 * omits half the list leaves someone hunting for one that is simply not drawn.
 * The count says what each holds; the choice stays with the user.
 *
 * The selection lives in the URL so it survives a reload, can be linked to, and
 * is readable by the server component that fetches on it.
 */
export function DnaAccountPicker({
  accounts,
  selected,
}: {
  accounts: PickerAccount[];
  selected: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);

  // Closing on an outside click or Escape is what makes this behave like a
  // menu rather than a panel that has to be dismissed by its own button.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const apply = (next: string[]) => {
    const search = new URLSearchParams(params.toString());
    if (next.length > 0) search.set("accounts", next.join(","));
    else search.delete("accounts");
    router.push(`?${search.toString()}`);
  };

  const toggle = (id: string) =>
    apply(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );

  const withWork = accounts.filter((account) => account.eligible > 0);
  const visible = query.trim()
    ? accounts.filter((account) =>
        account.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : accounts;

  const summary =
    selected.length === 0
      ? "No accounts selected"
      : selected.length === 1
        ? (accounts.find((a) => a.id === selected[0])?.label ?? "1 account")
        : `${selected.length} accounts selected`;

  return (
    <div ref={container} className="relative flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
        Ad accounts
      </span>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-9 min-w-64 items-center justify-between gap-2 rounded-md border border-border bg-transparent px-3 text-sm"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 flex max-h-96 w-80 flex-col gap-2 rounded-lg border border-border bg-background p-2 shadow-xl">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts…"
            className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
          />

          <div className="flex flex-wrap items-center gap-3 px-1">
            {withWork.length > 0 && (
              <button
                type="button"
                onClick={() => apply(withWork.map((account) => account.id))}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Select all with data
              </button>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => apply([])}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col overflow-y-auto">
            {visible.length === 0 ? (
              <span className="px-2 py-3 text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </span>
            ) : (
              visible.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(account.id)}
                    onChange={() => toggle(account.id)}
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {account.label}
                  </span>
                  {account.status && (
                    <span className="shrink-0 text-xs text-destructive/80">
                      {account.status}
                    </span>
                  )}
                  <span
                    className={
                      account.eligible > 0
                        ? "shrink-0 text-xs text-muted-foreground tabular-nums"
                        : "shrink-0 text-xs text-muted-foreground/40 tabular-nums"
                    }
                    title={
                      account.eligible > 0
                        ? `${account.eligible} creatives worth reading`
                        : "No creative with enough delivery yet"
                    }
                  >
                    {account.eligible}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <span className="text-xs text-muted-foreground">
          No ad accounts found. Fetch them under Intelligence → Ad Accounts
          first.
        </span>
      )}
    </div>
  );
}
