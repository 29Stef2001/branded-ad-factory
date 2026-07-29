import { beforeEach, describe, expect, it, vi } from "vitest";
import { generationStatusEnum } from "@/features/ad-concepts/domain/schemas";

/**
 * The generation lifecycle, against a stubbed Supabase client.
 *
 * These are the only tests here that reach into infrastructure/. They exist
 * because the expensive failures live in this layer: an attempt row that never
 * gets written, a status the database rejects, or an upload that fails after
 * the image has already been paid for.
 */

type UploadResult = { error: { message: string } | null };

const uploadCalls: { path: string }[] = [];
const inserted: Record<string, unknown>[] = [];
const updated: { id: string; values: Record<string, unknown> }[] = [];
let uploadResults: UploadResult[] = [];
let attemptCount = 0;

function supabaseStub() {
  return {
    storage: {
      from: () => ({
        upload: (path: string) => {
          uploadCalls.push({ path });
          return Promise.resolve(uploadResults.shift() ?? { error: null });
        },
      }),
    },
    from: () => {
      const builder: Record<string, unknown> = {
        insert(values: Record<string, unknown>) {
          inserted.push(values);
          return builder;
        },
        update(values: Record<string, unknown>) {
          builder._pendingUpdate = values;
          return builder;
        },
        select() {
          return builder;
        },
        eq(_column: string, value: string) {
          if (builder._pendingUpdate) {
            updated.push({
              id: value,
              values: builder._pendingUpdate as Record<string, unknown>,
            });
            builder._pendingUpdate = undefined;
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ count: attemptCount, error: null });
        },
        single() {
          return Promise.resolve({ data: { id: "attempt-1" }, error: null });
        },
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub()),
}));

// Imported after the mock is registered, so the module under test picks it up.
const {
  countGenerationAttempts,
  insertGenerationAttempt,
  updateGenerationAttempt,
  uploadConceptImage,
} =
  await import("@/features/ad-concepts/infrastructure/ad-concepts-repository");

beforeEach(() => {
  uploadCalls.length = 0;
  inserted.length = 0;
  updated.length = 0;
  uploadResults = [];
  attemptCount = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("attempt rows", () => {
  it("records an attempt when generation starts", async () => {
    const id = await insertGenerationAttempt({
      conceptId: "concept-1",
      attemptNumber: 1,
      status: "generating",
      selectedReferenceRoles: ["product", "owner"],
    });

    expect(id).toBe("attempt-1");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      concept_id: "concept-1",
      attempt_number: 1,
      status: "generating",
      selected_reference_roles: ["product", "owner"],
    });
  });

  it("writes explicit nulls rather than leaving QA columns undefined", async () => {
    await insertGenerationAttempt({
      conceptId: "concept-1",
      attemptNumber: 1,
      status: "generating",
      selectedReferenceRoles: [],
    });

    expect(inserted[0]).toMatchObject({
      image_path: null,
      qa_scores: null,
      qa_passed: null,
      failure_reason: null,
    });
  });

  it("numbers a retry above the attempts already recorded", async () => {
    attemptCount = 2;

    const next = (await countGenerationAttempts("concept-1")) + 1;

    expect(next).toBe(3);
  });

  it("starts at attempt 1 for a concept that has never generated", async () => {
    attemptCount = 0;

    expect((await countGenerationAttempts("concept-1")) + 1).toBe(1);
  });

  it("updates the existing attempt instead of inserting another", async () => {
    // A retry gets its own row; the phases within one attempt must not.
    await updateGenerationAttempt("attempt-1", { status: "generated" });
    await updateGenerationAttempt("attempt-1", { status: "qa_in_progress" });
    await updateGenerationAttempt("attempt-1", {
      status: "approved",
      qaPassed: true,
    });

    expect(inserted).toHaveLength(0);
    expect(updated.map((entry) => entry.id)).toEqual([
      "attempt-1",
      "attempt-1",
      "attempt-1",
    ]);
    expect(updated.map((entry) => entry.values.status)).toEqual([
      "generated",
      "qa_in_progress",
      "approved",
    ]);
  });
});

describe("status values", () => {
  it("only uses statuses the database check constraint allows", () => {
    // These are the exact values in the constraint on creative_generations.
    // The enum exists because inventing "running"/"succeeded" once cost a
    // 23514 violation at the end of a paid generation.
    expect(generationStatusEnum.options).toEqual([
      "queued",
      "generating",
      "generated",
      "qa_in_progress",
      "qa_failed",
      "retrying",
      "needs_review",
      "approved",
      "rejected",
      "ready_for_publishing",
      "published",
      "failed",
    ]);
  });

  it("rejects invented statuses at the type boundary", () => {
    for (const invented of ["running", "succeeded", "done", "error"]) {
      expect(generationStatusEnum.safeParse(invented).success).toBe(false);
    }
  });

  it("distinguishes a failed generation from a rejected image", () => {
    // "failed" means no image exists; "needs_review" means one does and QA
    // said no. Conflating them made the QA counts impossible to trust.
    expect(generationStatusEnum.safeParse("failed").success).toBe(true);
    expect(generationStatusEnum.safeParse("needs_review").success).toBe(true);
  });

  it("records a failure reason alongside the failed status", async () => {
    await updateGenerationAttempt("attempt-1", {
      status: "failed",
      failureReason: "fetch failed",
    });

    expect(updated[0].values).toMatchObject({
      status: "failed",
      failure_reason: "fetch failed",
    });
  });
});

describe("storage upload retries", () => {
  it("uploads once when storage answers first time", async () => {
    uploadResults = [{ error: null }];

    await uploadConceptImage("user/concept.png", Buffer.from("image"));

    expect(uploadCalls).toHaveLength(1);
  });

  it("retries a transient failure rather than losing a paid render", async () => {
    vi.useFakeTimers();
    uploadResults = [
      { error: { message: "fetch failed" } },
      { error: { message: "fetch failed" } },
      { error: null },
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const upload = uploadConceptImage("user/concept.png", Buffer.from("image"));
    await vi.runAllTimersAsync();
    await upload;

    expect(uploadCalls).toHaveLength(3);
    expect(uploadCalls.every((call) => call.path === "user/concept.png")).toBe(
      true,
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("logs each retry so a silent flake is visible afterwards", async () => {
    vi.useFakeTimers();
    uploadResults = [{ error: { message: "fetch failed" } }, { error: null }];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const upload = uploadConceptImage("user/concept.png", Buffer.from("image"));
    await vi.runAllTimersAsync();
    await upload;

    expect(warn.mock.calls[0][0]).toContain("attempt 1/3");
  });

  it("gives up after three attempts and surfaces the error", async () => {
    vi.useFakeTimers();
    uploadResults = [
      { error: { message: "fetch failed" } },
      { error: { message: "fetch failed" } },
      { error: { message: "fetch failed" } },
    ];
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const upload = uploadConceptImage("user/concept.png", Buffer.from("image"));
    const settled = expect(upload).rejects.toMatchObject({
      message: "fetch failed",
    });
    await vi.runAllTimersAsync();
    await settled;

    expect(uploadCalls).toHaveLength(3);
  });

  it("overwrites the same path on retry rather than orphaning a partial file", async () => {
    vi.useFakeTimers();
    uploadResults = [{ error: { message: "fetch failed" } }, { error: null }];
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const upload = uploadConceptImage("user/concept.png", Buffer.from("image"));
    await vi.runAllTimersAsync();
    await upload;

    expect(new Set(uploadCalls.map((call) => call.path)).size).toBe(1);
  });
});
