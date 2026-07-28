import type { QaResult } from "@/features/ad-concepts/domain/schemas";

/**
 * How much each dimension contributes to the overall score.
 *
 * Weighted rather than averaged because the dimensions are not equally
 * important to whether an ad can run: a render whose product is wrong is
 * unusable no matter how well composed it is, while mediocre mobile
 * readability is a reason to prefer another variant, not to discard this one.
 */
const SCORE_WEIGHTS: Record<keyof QaResult["scores"], number> = {
  productAccuracy: 3,
  logoAccuracy: 2,
  textAccuracy: 3,
  textLegibility: 2,
  brandConsistency: 2,
  materialRealism: 1.5,
  visualRealism: 2,
  conceptMatch: 1.5,
  mobileReadability: 1,
  policyRisk: 2,
};

/**
 * Below this an image is not worth publishing even with no hard failure — it
 * means several dimensions are mediocre at once.
 */
export const QA_PASS_THRESHOLD = 7;

/**
 * Conditions that fail a render outright, whatever the scores say.
 *
 * Each is a promise the pipeline makes and the score alone would let slide: an
 * unapproved promotional claim is a legal problem, Dutch text on a US ad is
 * wrong however beautiful it is, and a redesigned logo is not the brand's logo.
 */
type HardFailure = {
  key: string;
  failed: (qa: QaResult) => boolean;
  issue: string;
};

const HARD_FAILURES: HardFailure[] = [
  {
    key: "unapproved_message",
    failed: (qa) => qa.unapprovedMessageDetected,
    issue: "Shows promotional wording that is not on the approved list.",
  },
  {
    key: "message_wording",
    failed: (qa) => qa.approvedMessagePresent && !qa.messageWordingExactMatch,
    issue: "The approved message is present but the wording was altered.",
  },
  {
    key: "not_english",
    failed: (qa) => !qa.allVisibleTextIsEnglish,
    issue: "Text in the image is not English.",
  },
  {
    key: "misspelled",
    failed: (qa) => qa.textMisspelled,
    issue: "Text in the image is misspelled.",
  },
  {
    key: "logo_redesigned",
    failed: (qa) => qa.logoRedesigned,
    issue: "The logo was redrawn instead of reproduced.",
  },
  {
    key: "logo_missing",
    failed: (qa) => !qa.logoPresentWhenRequired,
    issue: "The logo is required for this concept but is not visible.",
  },
  {
    key: "product_changed",
    failed: (qa) => qa.productMaterialChanged,
    issue: "The product's material or finish was changed from the reference.",
  },
  {
    key: "owner_mismatch",
    failed: (qa) => qa.ownerReferenceProvided && !qa.ownerMatchesReference,
    issue: "The person shown does not match the brand's owner reference.",
  },
  {
    key: "artifacts",
    failed: (qa) => qa.seriousVisualArtifacts,
    issue:
      "Serious visual artifacts — extra fingers, warped shapes or similar.",
  },
];

export type QaVerdict = {
  score: number;
  passed: boolean;
  /** Hard failures first, then anything the model reported itself. */
  issues: string[];
  hardFailureKeys: string[];
};

export function evaluateQa(qa: QaResult): QaVerdict {
  const entries = Object.entries(SCORE_WEIGHTS) as [
    keyof QaResult["scores"],
    number,
  ][];

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = entries.reduce(
    (sum, [key, weight]) => sum + qa.scores[key] * weight,
    0,
  );
  const score = Math.round((weighted / totalWeight) * 100) / 100;

  const triggered = HARD_FAILURES.filter((failure) => failure.failed(qa));

  // The model's own issue list is merged in, de-duplicated against the hard
  // failures so the same problem is not reported twice in different words.
  const hardIssues = triggered.map((failure) => failure.issue);
  const modelIssues = qa.detectedIssues.filter(
    (issue) => issue.trim().length > 0,
  );
  const issues = [...new Set([...hardIssues, ...modelIssues])];

  return {
    score,
    passed: triggered.length === 0 && score >= QA_PASS_THRESHOLD,
    issues,
    hardFailureKeys: triggered.map((failure) => failure.key),
  };
}
