"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Which accounts' patterns are being read.
 *
 * Several at once, because one brand often runs across a handful of accounts
 * and its hooks are the same hooks. But never all of them by default: reading
 * every account together would count a jewellery hook and a headwear hook as
 * one finding, which is how a tally stops meaning anything.
 *
 * The choice lives in the URL rather than component state so it survives a
 * reload and can be linked to — and because the page fetches on the server,
 * which has to know before it renders.
 */
export function DnaAccountPicker({
  accounts,
  selected,
}: {
  accounts: { id: string; label: string; eligible: number }[];
  selected: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const apply = (next: string[]) => {
    const query = new URLSearchParams(params.toString());
    if (next.length > 0) query.set("accounts", next.join(","));
    else query.delete("accounts");
    router.push(`?${query.toString()}`);
  };

  const toggle = (id: string) =>
    apply(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );

  // Only accounts with something to read are worth offering: the rest would be
  // a choice that changes nothing.
  const withWork = accounts.filter((account) => account.eligible > 0);
  const rest = accounts.filter((account) => account.eligible === 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
          Ad accounts
        </span>
        {withWork.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => apply(withWork.map((account) => account.id))}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Select all with data
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => apply([])}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {withWork.map((account) => {
          const isOn = selected.includes(account.id);
          return (
            <Button
              key={account.id}
              type="button"
              size="sm"
              variant={isOn ? "default" : "outline"}
              onClick={() => toggle(account.id)}
            >
              {isOn && <Check aria-hidden className="size-3.5" />}
              <span className="max-w-52 truncate">{account.label}</span>
              <span className="text-xs opacity-70">{account.eligible}</span>
            </Button>
          );
        })}
      </div>

      {rest.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {rest.length} other selected account
          {rest.length === 1 ? " has" : "s have"} no creative with enough
          delivery to read yet.
        </span>
      )}
    </div>
  );
}
