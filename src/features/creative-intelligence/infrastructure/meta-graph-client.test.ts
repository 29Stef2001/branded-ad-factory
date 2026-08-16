import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdAccounts,
  fetchPages,
} from "@/features/creative-intelligence/infrastructure/meta-graph-client";

/**
 * The Graph client against a stubbed fetch. These lock in behaviour that only
 * showed up against the live API — particularly that asking for one field the
 * token cannot read fails the entire call rather than omitting that field.
 */

function stubFetch(handler: (url: string) => unknown) {
  const spy = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    status: 200,
    json: async () => handler(String(input)),
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAdAccounts", () => {
  it("maps the account list", async () => {
    stubFetch(() => ({
      data: [
        {
          id: "act_123",
          name: "Copper & Soul",
          currency: "USD",
          account_status: 1,
          business: { name: "Harrison" },
        },
      ],
    }));

    const page = await fetchAdAccounts("token");

    expect(page.items).toEqual([
      {
        adAccountId: "act_123",
        name: "Copper & Soul",
        currency: "USD",
        accountStatus: 1,
        businessName: "Harrison",
      },
    ]);
  });

  it("still returns accounts when business_management is missing", async () => {
    // The live failure: requesting business{name} without the permission makes
    // Graph reject the whole call, so a list ads_read could have served came
    // back empty. The retry drops the field rather than the result.
    const spy = stubFetch((url) => {
      if (url.includes("business")) {
        return {
          error: { message: "(#100) Requires business_management", code: 100 },
        };
      }
      return {
        data: [{ id: "act_123", name: "Copper & Soul", currency: "USD" }],
      };
    });

    const page = await fetchAdAccounts("token");

    expect(spy).toHaveBeenCalledTimes(2);
    expect(page.items[0]).toMatchObject({
      adAccountId: "act_123",
      name: "Copper & Soul",
      businessName: null,
    });
  });

  it("reports another page only when Graph says there is one", async () => {
    // A cursor comes back even on the final page, so keying off it would loop
    // for ever. `next` is the only honest signal.
    stubFetch(() => ({
      data: [{ id: "act_1" }],
      paging: { cursors: { after: "CURSOR" } },
    }));

    expect((await fetchAdAccounts("token")).nextCursor).toBeNull();

    vi.unstubAllGlobals();
    stubFetch(() => ({
      data: [{ id: "act_1" }],
      paging: { cursors: { after: "CURSOR" }, next: "https://graph…" },
    }));

    expect((await fetchAdAccounts("token")).nextCursor).toBe("CURSOR");
  });
});

describe("fetchPages", () => {
  it("maps pages with their own token and linked Instagram account", async () => {
    stubFetch(() => ({
      data: [
        {
          id: "page_1",
          name: "Copper & Soul",
          access_token: "page-token",
          instagram_business_account: { id: "ig_1" },
        },
      ],
    }));

    expect((await fetchPages("token")).items[0]).toEqual({
      pageId: "page_1",
      name: "Copper & Soul",
      pageAccessToken: "page-token",
      instagramActorId: "ig_1",
    });
  });

  it("returns an empty list rather than throwing when there are no pages", async () => {
    // What this account returns today. Indistinguishable from pages_show_list
    // not being granted, which is why the UI has to say both are possible.
    stubFetch(() => ({ data: [] }));

    expect((await fetchPages("token")).items).toEqual([]);
  });
});
