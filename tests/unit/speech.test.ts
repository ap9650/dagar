import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which language the lesson is READ ALOUD in.
 *
 * The whole feature exists because a teacher pointed out that reading and
 * listening are different abilities — a learner reading English may want it
 * explained in Hindi. So the two settings are separate, and the default has to
 * be right or the separation just becomes friction: a Hindi learner should not
 * have to find a toggle to hear the language they already chose once.
 */

function stub({
  voices = ["en-IN", "hi-IN"],
  stored = null as string | null,
}) {
  vi.stubGlobal("window", {
    speechSynthesis: {
      getVoices: () => voices.map((lang) => ({ lang, name: lang })),
      speaking: false,
      addEventListener: vi.fn(),
      cancel: vi.fn(),
    },
  });
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem: vi.fn() });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  return import("@/lib/speech");
}

describe("listening language", () => {
  beforeEach(() => vi.resetModules());

  it("defaults to the language being READ when nothing is stored", async () => {
    stub({});
    const speech = await load();
    speech.refresh("hi");
    expect(speech.getSnapshot().lang).toBe("hi");
  });

  it("an explicit choice beats the reading language", async () => {
    stub({ stored: "en" });
    const speech = await load();
    speech.refresh("hi");
    expect(speech.getSnapshot().lang).toBe("en");
  });

  it("never picks a language the device cannot speak", async () => {
    // A Hindi learner on a phone with no Hindi voice pack. Choosing "hi" here
    // would produce an English voice reading Devanagari — which is precisely the
    // bug that was reported.
    stub({ voices: ["en-IN"] });
    const speech = await load();
    speech.refresh("hi");
    expect(speech.getSnapshot().lang).toBe("en");
    expect(speech.getSnapshot().available).toEqual(["en"]);
  });

  it("ignores a stored language the device has since lost", async () => {
    stub({ voices: ["en-IN"], stored: "hi" });
    const speech = await load();
    speech.refresh("hi");
    expect(speech.getSnapshot().lang).toBe("en");
  });

  it("reports both when both are installed", async () => {
    stub({});
    const speech = await load();
    speech.refresh("en");
    expect(speech.getSnapshot().available).toEqual(["en", "hi"]);
  });

  it("offers nothing on a device with no voices at all", async () => {
    stub({ voices: [] });
    const speech = await load();
    speech.refresh("en");
    expect(speech.getSnapshot().available).toEqual([]);
  });

  it("does nothing at all during a server render", async () => {
    vi.stubGlobal("window", undefined);
    const speech = await load();
    expect(() => speech.refresh("hi")).not.toThrow();
    expect(speech.getServerSnapshot().available).toEqual([]);
  });
});
