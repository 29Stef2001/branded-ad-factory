import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdAccounts,
  fetchPages,
  MetaGraphError,
} from "@/features/creative-intelligence/infrastructure/meta-graph-client";

/**
 * The Graph client against a stubbed fetch. These lock in behaviour that only
 * showed up against the live API — particularly that asking for one field the
 * token cannot read fails the entire call rather than omitting that field.
 */

/**
 * A stubbed fetch that answers with a body the client reads the way it reads a
 * real Response.
 *
 * `text()` rather than `json()`, because that is what the client calls: Meta
 * does not always answer with JSON, and a stub that can only produce parsed
 * objects cannot express the HTML error page that broke a live sync. Serialising
 * here keeps the stub honest — the client does its own parsing, as it must.
 */
function stubFetch(
  handler: (url: string) => unknown,
  init: { ok?: boolean; status?: number; contentType?: string } = {},
) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const body = handler(String(input));
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      headers: new Headers({
        "content-type": init.contentType ?? "application/json",
      }),
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    };
  });
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

describe("a non-JSON answer", () => {
  /**
   * Meta answered a live sync with an HTML gateway page. `response.json()`
   * threw a bare `SyntaxError: Unexpected token '<'` that named no account, no
   * path and no status; because it was not a MetaGraphError, `isRetryable()`
   * said no and one bad response aborted a walk over thirty accounts.
   */
  it("is reported as a Meta error naming the status and the path", async () => {
    stubFetch(() => "<!DOCTYPE html><html><body>Bad gateway</body></html>", {
      ok: false,
      status: 502,
      contentType: "text/html",
    });

    const error = await fetchAdAccounts("token").catch((e) => e);

    expect(error).toBeInstanceOf(MetaGraphError);
    expect(error.message).toContain("502");
    expect(error.message).toContain("text/html");
    // A gateway error is transient, so the sync is allowed to come back.
    expect(error.isRateLimit).toBe(true);
  });

  it("does not invite a retry when the status is a client error", async () => {
    stubFetch(() => "<html>Forbidden</html>", {
      ok: false,
      status: 403,
      contentType: "text/html",
    });

    const error = await fetchAdAccounts("token").catch((e) => e);

    expect(error).toBeInstanceOf(MetaGraphError);
    expect(error.isRateLimit).toBe(false);
  });
});
