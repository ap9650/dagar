import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic, hapticsEnabled, hapticsSupported, PATTERNS, setHapticsEnabled } from "@/lib/haptics";

/**
 * Haptics are cheap to add and easy to get quietly wrong in two ways that both
 * hurt the same learner:
 *
 *   1. Buzzing on a WRONG answer — the amber-not-red rule broken in a different
 *      sense, a physical reprimand for mixing up a sign.
 *   2. Buzzing when someone has asked their device not to do that.
 *
 * Both are tested here, and the first is tested structurally — there is no
 * `wrong` pattern to reach for in the first place.
 */

function stubEnvironment({
  vibrate = vi.fn(),
  reducedMotion = false,
  stored = null as string | null,
}) {
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: reducedMotion }),
    localStorage: { getItem: () => stored, setItem: vi.fn() },
  });
  return vibrate;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PATTERNS", () => {
  it("has NO pattern for a wrong answer", () => {
    // Structural, not stylistic. If there is no pattern, nobody can wire one up
    // in a hurry six weeks from now.
    expect(Object.keys(PATTERNS)).not.toContain("wrong");
    expect(Object.keys(PATTERNS)).not.toContain("incorrect");
    expect(Object.keys(PATTERNS)).not.toContain("error");
  });

  it("keeps every buzz short", () => {
    // A long vibration on a shared phone announces to the room that a child is
    // doing schoolwork. That is not ours to announce.
    for (const pattern of Object.values(PATTERNS)) {
      for (const ms of pattern) expect(ms).toBeLessThanOrEqual(80);
      const total = pattern.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(400);
    }
  });
});

describe("hapticsSupported", () => {
  it("is false where there is no Vibration API — every iPhone", () => {
    vi.stubGlobal("navigator", {});
    expect(hapticsSupported()).toBe(false);
  });

  it("is true on a device that has it", () => {
    stubEnvironment({});
    expect(hapticsSupported()).toBe(true);
  });
});

describe("hapticsEnabled", () => {
  it("defaults ON where supported and nothing is stored", () => {
    stubEnvironment({});
    expect(hapticsEnabled()).toBe(true);
  });

  it("is OFF under prefers-reduced-motion, whatever the stored value", () => {
    stubEnvironment({ reducedMotion: true, stored: "on" });
    expect(hapticsEnabled()).toBe(false);
  });

  it("is OFF when the learner turned it off", () => {
    stubEnvironment({ stored: "off" });
    expect(hapticsEnabled()).toBe(false);
  });

  it("is OFF when the device cannot vibrate at all", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(hapticsEnabled()).toBe(false);
  });
});

describe("haptic", () => {
  it("vibrates with the named pattern", () => {
    const vibrate = stubEnvironment({});
    haptic("milestone");
    expect(vibrate).toHaveBeenCalledWith(PATTERNS.milestone);
  });

  it("does nothing under reduced motion", () => {
    const vibrate = stubEnvironment({ reducedMotion: true });
    haptic("correct");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does nothing when switched off", () => {
    const vibrate = stubEnvironment({ stored: "off" });
    haptic("correct");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("never throws, even when the browser refuses", () => {
    // Chrome throws if the document is not focused. A lesson must not crash
    // because a buzz was declined.
    stubEnvironment({
      vibrate: vi.fn(() => {
        throw new Error("not focused");
      }),
    });
    expect(() => haptic("complete")).not.toThrow();
  });

  it("never throws where there is no API", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(() => haptic("streak")).not.toThrow();
  });
});

describe("setHapticsEnabled", () => {
  it("writes the choice so it survives a reload", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem });
    setHapticsEnabled(false);
    expect(setItem).toHaveBeenCalledWith("saathi.haptics", "off");
    setHapticsEnabled(true);
    expect(setItem).toHaveBeenCalledWith("saathi.haptics", "on");
  });
});
