/**
 * The pipeline as the user experiences it, from an empty account to a launched
 * ad — and where they currently are in it.
 *
 * Step order is dependency order, not subject order. Promotional messages sit
 * before concepts because concept generation refuses to run without an enabled
 * one; listing them later would mean a first-time user hits a blocked step
 * whose fix is further down the list.
 */

export type WorkflowStepState = "done" | "current" | "blocked" | "todo";

export type WorkflowStep = {
  key: string;
  label: string;
  href: string;
  state: WorkflowStepState;
  /** Short status, e.g. "3 assets" or "needs a founder photo". */
  detail: string;
};

export type WorkflowInput = {
  hasProfile: boolean;
  completenessScore: number;
  hasOwnerAsset: boolean;
  hasProductAsset: boolean;
  hasLogoAsset: boolean;
  assetsActive: number;
  messagesEnabled: number;
  conceptsTotal: number;
  conceptsWithImage: number;
  qaReviewed: number;
  qaFailed: number;
  metaCanLaunch: boolean;
};

export function buildWorkflow(input: WorkflowInput): WorkflowStep[] {
  const criticalAssets = [
    input.hasOwnerAsset,
    input.hasProductAsset,
    input.hasLogoAsset,
  ].filter(Boolean).length;

  const steps: Omit<WorkflowStep, "state">[] = [
    {
      key: "brand-profile",
      label: "Brand Profile",
      href: "/dashboard/brand-profile",
      detail: input.hasProfile
        ? `${input.completenessScore}% complete`
        : "not created yet",
    },
    {
      key: "brand-assets",
      label: "Brand Assets",
      href: "/dashboard/creative-studio/brand-assets",
      detail:
        criticalAssets === 3
          ? `${input.assetsActive} assets, all key types`
          : `${criticalAssets} of 3 key types uploaded`,
    },
    {
      key: "messages",
      label: "Promotional Messages",
      href: "/dashboard/promotional-messages",
      detail:
        input.messagesEnabled > 0
          ? `${input.messagesEnabled} enabled`
          : "none enabled — blocks generation",
    },
    {
      key: "concepts",
      label: "Concepts",
      href: "/dashboard/concepts",
      detail:
        input.conceptsTotal > 0
          ? `${input.conceptsTotal} generated`
          : "none yet",
    },
    {
      key: "prompt-builder",
      label: "Prompt Builder",
      href: "/dashboard/creative-studio/prompt-builder",
      detail:
        input.conceptsTotal > 0
          ? "review and edit prompts"
          : "needs a concept first",
    },
    {
      key: "images",
      label: "Images",
      href: "/dashboard/concepts",
      detail:
        input.conceptsWithImage > 0
          ? `${input.conceptsWithImage} of ${input.conceptsTotal} concepts`
          : "none generated",
    },
    {
      key: "qa",
      label: "Image QA",
      href: "/dashboard/creative-studio/image-qa",
      detail:
        input.qaReviewed === 0
          ? "runs automatically"
          : input.qaFailed > 0
            ? `${input.qaFailed} need review`
            : `${input.qaReviewed} reviewed, all passed`,
    },
    {
      key: "launch",
      label: "Launch in Meta",
      href: "/dashboard/ad-factory/launch",
      // Says what is true rather than what the permission implies. The check
      // below is on ads_management, and holding it made this read "ready to
      // draft" — so the step invited a click through to a panel that creates
      // nothing. Drafting is not built, and a workflow that overstates its own
      // last step is worse than one that admits the gap.
      detail: input.metaCanLaunch
        ? "permission granted — drafting not built yet"
        : "read-only access — needs Meta App Review",
    },
  ];

  // A step is done when its own condition is met, blocked when it cannot
  // proceed regardless of effort, and current when it is the first thing not
  // yet done. Only one step is ever "current" — a progress indicator that
  // highlights three things at once is not a next step.
  const done: Record<string, boolean> = {
    "brand-profile": input.hasProfile && input.completenessScore >= 60,
    "brand-assets": criticalAssets === 3,
    messages: input.messagesEnabled > 0,
    concepts: input.conceptsTotal > 0,
    "prompt-builder": input.conceptsTotal > 0,
    images: input.conceptsWithImage > 0,
    qa: input.qaReviewed > 0 && input.qaFailed === 0,
    launch: false,
  };

  const blocked: Record<string, boolean> = {
    // Launch is not something effort can fix — the permission comes from Meta.
    launch: !input.metaCanLaunch,
  };

  let currentAssigned = false;

  return steps.map((step) => {
    let state: WorkflowStepState;

    if (blocked[step.key]) {
      state = "blocked";
    } else if (done[step.key]) {
      state = "done";
    } else if (!currentAssigned) {
      state = "current";
      currentAssigned = true;
    } else {
      state = "todo";
    }

    return { ...step, state };
  });
}
