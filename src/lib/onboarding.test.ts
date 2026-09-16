import { describe, expect, it } from "vitest";
import { deriveOnboarding } from "./onboarding";

describe("deriveOnboarding", () => {
  it("starts with Connect as current for owners", () => {
    const snap = deriveOnboarding({
      stripeOnboardingComplete: false,
      invoiceCount: 0,
      hasInviteLink: false,
      inviteShared: false,
      canConnect: true,
    });
    expect(snap.complete).toBe(false);
    expect(snap.doneCount).toBe(0);
    expect(snap.currentId).toBe("connect");
    expect(snap.steps[2].locked).toBe(true);
  });

  it("advances to upload after Connect", () => {
    const snap = deriveOnboarding({
      stripeOnboardingComplete: true,
      invoiceCount: 0,
      hasInviteLink: false,
      inviteShared: false,
      canConnect: true,
    });
    expect(snap.doneCount).toBe(1);
    expect(snap.currentId).toBe("upload");
  });

  it("unlocks invite after upload; completes only after share", () => {
    const mid = deriveOnboarding({
      stripeOnboardingComplete: true,
      invoiceCount: 1,
      hasInviteLink: true,
      inviteShared: false,
      canConnect: true,
    });
    expect(mid.currentId).toBe("invite");
    expect(mid.steps[2].locked).toBe(false);
    expect(mid.doneCount).toBe(2);

    const done = deriveOnboarding({
      stripeOnboardingComplete: true,
      invoiceCount: 2,
      hasInviteLink: true,
      inviteShared: true,
      canConnect: true,
    });
    expect(done.complete).toBe(true);
    expect(done.currentId).toBeNull();
  });

  it("uses clerk copy when Connect is not allowed", () => {
    const snap = deriveOnboarding({
      stripeOnboardingComplete: false,
      invoiceCount: 0,
      hasInviteLink: false,
      inviteShared: false,
      canConnect: false,
    });
    expect(snap.steps[0].description).toMatch(/owner/i);
    expect(snap.currentId).toBe("connect");
  });
});
