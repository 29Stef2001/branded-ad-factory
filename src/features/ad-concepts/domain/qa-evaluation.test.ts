import { describe, expect, it } from "vitest";
import {
  QA_PASS_THRESHOLD,
  evaluateQa,
} from "@/features/ad-concepts/domain/qa-evaluation";
import type { QaResult } from "@/features/ad-concepts/domain/schemas";

/** A clean pass: every dimension high, every hard-failure flag benign. */
function qa(overrides: Partial<QaResult> = {}): QaResult {
  return {
    scores: {
      productAccuracy: 9,
      logoAccuracy: 9,
      textAccuracy: 9,
      textLegibility: 9,
      brandConsistency: 9,
      materialRealism: 9,
      visualRealism: 9,
      conceptMatch: 9,
      mobileReadability: 9,
      policyRisk: 9,
    },
    unapprovedMessageDetected: false,
    approvedMessagePresent: true,
    messageWordingExactMatch: true,
    allVisibleTextIsEnglish: true,
    textMisspelled: false,
    logoRedesigned: false,
    logoPresentWhenRequired: true,
    productMaterialChanged: false,
    ownerReferenceProvided: true,
    ownerMatchesReference: true,
    seriousVisualArtifacts: false,
    detectedIssues: [],
    notes: "Clean.",
    suggestedPromptFix: "",
    ...overrides,
  } as QaResult;
}

describe("evaluateQa — scoring", () => {
  it("passes a clean render", () => {
    const verdict = evaluateQa(qa());

    expect(verdict.passed).toBe(true);
    expect(verdict.score).toBe(9);
    expect(verdict.hardFailureKeys).toEqual([]);
  });

  it("weights dimensions rather than averaging them", () => {
    // productAccuracy carries weight 3 and mobileReadability weight 1, so the
    // same drop in each cannot cost the same.
    const productPoor = evaluateQa(
      qa({ scores: { ...qa().scores, productAccuracy: 1 } }),
    );
    const mobilePoor = evaluateQa(
      qa({ scores: { ...qa().scores, mobileReadability: 1 } }),
    );

    expect(productPoor.score).toBeLessThan(mobilePoor.score);
  });

  it("fails a render that is mediocre across the board with no hard failure", () => {
    const mediocre = evaluateQa(
      qa({
        scores: {
          productAccuracy: 6,
          logoAccuracy: 6,
          textAccuracy: 6,
          textLegibility: 6,
          brandConsistency: 6,
          materialRealism: 6,
          visualRealism: 6,
          conceptMatch: 6,
          mobileReadability: 6,
          policyRisk: 6,
        },
      }),
    );

    expect(mediocre.hardFailureKeys).toEqual([]);
    expect(mediocre.score).toBeLessThan(QA_PASS_THRESHOLD);
    expect(mediocre.passed).toBe(false);
  });
});

describe("evaluateQa — hard failures override the threshold", () => {
  const cases: [string, Partial<QaResult>, string][] = [
    [
      "an unapproved promotional claim",
      { unapprovedMessageDetected: true },
      "unapproved_message",
    ],
    [
      "the approved message reworded",
      { approvedMessagePresent: true, messageWordingExactMatch: false },
      "message_wording",
    ],
    [
      "text that is not English",
      { allVisibleTextIsEnglish: false },
      "not_english",
    ],
    ["misspelled text", { textMisspelled: true }, "misspelled"],
    ["a redrawn logo", { logoRedesigned: true }, "logo_redesigned"],
    [
      "a missing required logo",
      { logoPresentWhenRequired: false },
      "logo_missing",
    ],
    [
      "a changed product material",
      { productMaterialChanged: true },
      "product_changed",
    ],
    [
      "someone other than the owner",
      { ownerReferenceProvided: true, ownerMatchesReference: false },
      "owner_mismatch",
    ],
    ["serious artifacts", { seriousVisualArtifacts: true }, "artifacts"],
  ];

  it.each(cases)("rejects %s despite a high score", (_label, flags, key) => {
    const verdict = evaluateQa(qa(flags));

    // The point of a hard failure: the numbers are excellent and it still fails.
    expect(verdict.score).toBeGreaterThanOrEqual(QA_PASS_THRESHOLD);
    expect(verdict.passed).toBe(false);
    expect(verdict.hardFailureKeys).toContain(key);
  });

  it("explains each hard failure in plain language", () => {
    const verdict = evaluateQa(qa({ logoRedesigned: true }));

    expect(verdict.issues).toContain(
      "The logo was redrawn instead of reproduced.",
    );
  });

  it("reports every hard failure, not just the first", () => {
    const verdict = evaluateQa(
      qa({
        logoRedesigned: true,
        textMisspelled: true,
        seriousVisualArtifacts: true,
      }),
    );

    expect(verdict.hardFailureKeys).toEqual(
      expect.arrayContaining(["logo_redesigned", "misspelled", "artifacts"]),
    );
  });

  it("does not flag an owner mismatch when no owner reference was given", () => {
    // Without a reference there is nothing to mismatch against, so this must
    // not fail renders for brands that have uploaded no owner photo.
    const verdict = evaluateQa(
      qa({ ownerReferenceProvided: false, ownerMatchesReference: false }),
    );

    expect(verdict.hardFailureKeys).not.toContain("owner_mismatch");
    expect(verdict.passed).toBe(true);
  });

  it("does not flag wording when no approved message is present at all", () => {
    const verdict = evaluateQa(
      qa({ approvedMessagePresent: false, messageWordingExactMatch: false }),
    );

    expect(verdict.hardFailureKeys).not.toContain("message_wording");
  });
});

describe("evaluateQa — brand threshold", () => {
  const eight = qa({
    scores: {
      productAccuracy: 8,
      logoAccuracy: 8,
      textAccuracy: 8,
      textLegibility: 8,
      brandConsistency: 8,
      materialRealism: 8,
      visualRealism: 8,
      conceptMatch: 8,
      mobileReadability: 8,
      policyRisk: 8,
    },
  });

  it("uses the shared bar when the brand sets none", () => {
    expect(evaluateQa(eight).passed).toBe(true);
    expect(evaluateQa(eight, null).passed).toBe(true);
    expect(QA_PASS_THRESHOLD).toBe(7);
  });

  it("honours a stricter brand-specific minimum", () => {
    expect(evaluateQa(eight, 9).passed).toBe(false);
    expect(evaluateQa(eight, 8).passed).toBe(true);
  });

  it("honours a more permissive brand-specific minimum", () => {
    const six = qa({
      scores: {
        productAccuracy: 6,
        logoAccuracy: 6,
        textAccuracy: 6,
        textLegibility: 6,
        brandConsistency: 6,
        materialRealism: 6,
        visualRealism: 6,
        conceptMatch: 6,
        mobileReadability: 6,
        policyRisk: 6,
      },
    });

    expect(evaluateQa(six).passed).toBe(false);
    expect(evaluateQa(six, 5).passed).toBe(true);
  });

  it("never lets a lowered threshold rescue a hard failure", () => {
    // A brand cannot configure its way past an unapproved legal claim.
    const verdict = evaluateQa(qa({ unapprovedMessageDetected: true }), 0);

    expect(verdict.passed).toBe(false);
  });
});

describe("evaluateQa — issue reporting", () => {
  it("merges the model's own issues with the hard failures", () => {
    const verdict = evaluateQa(
      qa({
        logoRedesigned: true,
        detectedIssues: ["The hang tag is cropped."],
      }),
    );

    expect(verdict.issues).toContain(
      "The logo was redrawn instead of reproduced.",
    );
    expect(verdict.issues).toContain("The hang tag is cropped.");
  });

  it("does not report the same issue twice", () => {
    const duplicate = "The logo was redrawn instead of reproduced.";
    const verdict = evaluateQa(
      qa({ logoRedesigned: true, detectedIssues: [duplicate] }),
    );

    expect(verdict.issues.filter((issue) => issue === duplicate)).toHaveLength(
      1,
    );
  });

  it("drops blank issues the model sometimes emits", () => {
    const verdict = evaluateQa(qa({ detectedIssues: ["", "   "] }));

    expect(verdict.issues).toEqual([]);
  });
});
