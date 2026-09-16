/** Post-register merchant setup steps for Path B. */

export type OnboardingStepId = "connect" | "upload" | "invite";

export type OnboardingStepState = {
  id: OnboardingStepId;
  title: string;
  description: string;
  done: boolean;
  locked: boolean;
};

export type OnboardingSnapshot = {
  steps: OnboardingStepState[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** First incomplete step — drives primary CTA emphasis. */
  currentId: OnboardingStepId | null;
};

export type OnboardingInputs = {
  stripeOnboardingComplete: boolean;
  invoiceCount: number;
  /** True when at least one customer invite token is available to share. */
  hasInviteLink: boolean;
  /** Owner marked the invite as shared (copy/open). */
  inviteShared: boolean;
  /** OWNER/ADMIN/BUSINESS can start Connect; clerks wait on an owner. */
  canConnect: boolean;
};

const STEP_COPY: Record<
  OnboardingStepId,
  { title: string; description: string; clerkDescription?: string }
> = {
  connect: {
    title: "Connect your Canadian bank",
    description:
      "Stripe Connect Express — you stay Merchant of Record. Pymtx never holds principal.",
    clerkDescription:
      "An owner must finish Stripe Connect before debits can settle.",
  },
  upload: {
    title: "Upload past-due accounts",
    description:
      "CSV or a quick sample invite. Each row creates a customer and aging balance.",
  },
  invite: {
    title: "Share the PAD invite",
    description:
      "Send your customer the client link so they can authorize ACSS Debit and pick a plan.",
  },
};

/**
 * Derive checklist progress from business + invoice state.
 * Invite is ready once upload produced at least one shareable client link.
 */
export function deriveOnboarding(input: OnboardingInputs): OnboardingSnapshot {
  const connectDone = input.stripeOnboardingComplete;
  const uploadDone = input.invoiceCount > 0;
  const inviteDone = input.hasInviteLink && input.inviteShared;

  const steps: OnboardingStepState[] = [
    {
      id: "connect",
      title: STEP_COPY.connect.title,
      description: input.canConnect
        ? STEP_COPY.connect.description
        : (STEP_COPY.connect.clerkDescription ?? STEP_COPY.connect.description),
      done: connectDone,
      locked: false,
    },
    {
      id: "upload",
      title: STEP_COPY.upload.title,
      description: STEP_COPY.upload.description,
      done: uploadDone,
      // Allow upload before Connect so clerks can stage receivables; settlement still needs Connect.
      locked: false,
    },
    {
      id: "invite",
      title: STEP_COPY.invite.title,
      description: STEP_COPY.invite.description,
      done: inviteDone,
      locked: !uploadDone,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done && !s.locked) ?? null;

  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    currentId: current?.id ?? null,
  };
}

export function onboardingDismissKey(businessId: string) {
  return `pymtx:onboarding:dismissed:v1:${businessId}`;
}

export function onboardingInviteSharedKey(businessId: string) {
  return `pymtx:onboarding:invite-shared:v1:${businessId}`;
}
