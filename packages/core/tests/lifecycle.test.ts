import { afterEach, describe, expect, it, vi } from "vitest";
import { getGlobal } from "../src/availability";
import { type AiCtor, SessionLifecycle } from "../src/lifecycle";
import { ActivationRequiredError, deriveModelStatus, UnavailableError } from "../src/types";
import { captureStates, installGlobal, makeFakeApi, setUserActivation } from "./helpers";

interface S {
  prompt(i: string): Promise<string>;
  promptStreaming(i: string, o?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy?(): void;
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

function lifecycleFor(api: ReturnType<typeof makeFakeApi>) {
  cleanups.push(installGlobal("LanguageModel", api.Ctor));
  return new SessionLifecycle<S>({
    api: "LanguageModel",
    getCtor: () => getGlobal<AiCtor<S>>("LanguageModel"),
    createOptions: () => ({ expectedInputs: [{ type: "text", languages: ["en"] }] }),
    availabilityOptions: () => ({ expectedInputs: [{ type: "text", languages: ["en"] }] }),
  });
}

describe("SessionLifecycle", () => {
  it("getSnapshot returns the same frozen ref until a real change", async () => {
    const life = lifecycleFor(makeFakeApi());
    const a = life.getSnapshot();
    const b = life.getSnapshot();
    expect(a).toBe(b); // referentially identical — useSyncExternalStore won't loop
    expect(Object.isFrozen(a)).toBe(true);
    await life.refresh();
    expect(life.getSnapshot()).not.toBe(a); // new ref after a change
  });

  it("getServerSnapshot is a stable unavailable state (SSR safe)", () => {
    const life = lifecycleFor(makeFakeApi());
    const s1 = life.getServerSnapshot();
    expect(s1).toBe(life.getServerSnapshot());
    expect(s1.supported).toBe(false);
    expect(s1.availability).toBe("unavailable");
  });

  it("tracks whether availability has been checked yet (no premature download CTA)", async () => {
    const api = makeFakeApi({ availability: "available" });
    const life = lifecycleFor(api);

    // Before refresh: availability is an optimistic guess and `checked` is false, so a UI
    // can show a neutral "checking" state instead of a download CTA.
    const before = life.getSnapshot();
    expect(before.checked).toBe(false);
    expect(deriveModelStatus(before, () => Promise.resolve()).isChecking).toBe(true);

    await life.refresh();

    // After refresh: settled on the real availability; isChecking clears.
    const after = life.getSnapshot();
    expect(after.checked).toBe(true);
    expect(after.availability).toBe("available");
    expect(deriveModelStatus(after, () => Promise.resolve()).isChecking).toBe(false);
  });

  it("dedups concurrent warm() into a single create()", async () => {
    const api = makeFakeApi();
    const life = lifecycleFor(api);
    await life.refresh();
    const [s1, s2] = await Promise.all([life.warm(), life.warm()]);
    expect(s1).toBe(s2);
    expect(api.createCount()).toBe(1);
  });

  it("download() reports progress through the monitor", async () => {
    cleanups.push(setUserActivation(true));
    const api = makeFakeApi({ availability: "downloadable", emitProgress: [0.25, 0.75] });
    const life = lifecycleFor(api);
    const states = await captureStates(life, async () => {
      await life.download();
    });
    const progresses = states.map((s) => s.downloadProgress);
    expect(progresses).toContain(0.25);
    expect(progresses).toContain(0.75);
    expect(states.some((s) => s.availability === "downloading")).toBe(true);
    expect(life.getSnapshot().availability).toBe("available");
    expect(life.getSnapshot().downloadProgress).toBe(1);
  });

  it("normalizes byte-style downloadprogress (loaded/total, Edge) to a 0..1 fraction", async () => {
    cleanups.push(setUserActivation(true));
    const api = makeFakeApi({
      availability: "downloadable",
      emitProgress: [
        { loaded: 1_000_000, total: 4_000_000 },
        { loaded: 3_000_000, total: 4_000_000 },
      ],
    });
    const life = lifecycleFor(api);
    const states = await captureStates(life, async () => {
      await life.download();
    });
    const progresses = states.map((s) => s.downloadProgress);
    expect(progresses).toContain(0.25);
    expect(progresses).toContain(0.75);
    expect(progresses.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it("clamps overshooting downloadprogress to 1 (bytes past total, fractions past 1)", async () => {
    cleanups.push(setUserActivation(true));
    const api = makeFakeApi({
      availability: "downloadable",
      emitProgress: [{ loaded: 5_000_000, total: 4_000_000 }, 1.5],
    });
    const life = lifecycleFor(api);
    const states = await captureStates(life, async () => {
      await life.download();
    });
    const progresses = states.map((s) => s.downloadProgress);
    expect(progresses.every((p) => p >= 0 && p <= 1)).toBe(true);
    expect(life.getSnapshot().downloadProgress).toBe(1);
  });

  it("warm() never starts a download — throws ActivationRequiredError when downloadable", async () => {
    // Even WITH a user gesture, a normal call must not silently pull the model.
    cleanups.push(setUserActivation(true));
    const api = makeFakeApi({ availability: "downloadable" });
    const life = lifecycleFor(api);
    await expect(life.warm()).rejects.toBeInstanceOf(ActivationRequiredError);
    expect(api.createCount()).toBe(0); // nothing was created/downloaded
  });

  it("download() without a user gesture throws ActivationRequiredError", async () => {
    cleanups.push(setUserActivation(false));
    const life = lifecycleFor(makeFakeApi({ availability: "downloadable" }));
    await expect(life.download()).rejects.toBeInstanceOf(ActivationRequiredError);
  });

  it("download({ requireGesture: false }) bypasses the activation check (extension offscreen doc)", async () => {
    // No transient activation in this document: the gesture happened in the extension's
    // popup/side panel and was verified before the message reached the offscreen document.
    cleanups.push(setUserActivation(false));
    const api = makeFakeApi({ availability: "downloadable" });
    const life = lifecycleFor(api);
    const session = await life.download({ requireGesture: false });
    expect(session).toBeDefined();
    expect(api.createCount()).toBe(1); // the download actually started
    expect(life.getSnapshot().availability).toBe("available");
  });

  it("download({ requireGesture: true }) matches the default — still throws without a gesture", async () => {
    cleanups.push(setUserActivation(false));
    const life = lifecycleFor(makeFakeApi({ availability: "downloadable" }));
    await expect(life.download({ requireGesture: true })).rejects.toBeInstanceOf(
      ActivationRequiredError,
    );
  });

  it("warm() opens a session without a gesture once availability is 'available'", async () => {
    cleanups.push(setUserActivation(false));
    const api = makeFakeApi({ availability: "available" });
    const life = lifecycleFor(api);
    await expect(life.warm()).resolves.toBeDefined();
    expect(api.createCount()).toBe(1);
  });

  it("is unavailable (no throw) when the global is absent", async () => {
    const life = new SessionLifecycle<S>({
      api: "LanguageModel",
      getCtor: () => getGlobal<AiCtor<S>>("LanguageModel"), // not installed
      createOptions: () => ({}),
    });
    expect(life.getSnapshot().supported).toBe(false);
    await expect(life.refresh()).resolves.toBe("unavailable");
    await expect(life.warm()).rejects.toBeInstanceOf(UnavailableError);
  });

  it("invalidate() destroys the session and re-checks availability", async () => {
    const api = makeFakeApi();
    const life = lifecycleFor(api);
    const session = await life.warm();
    life.invalidate();
    expect(session.destroy).toHaveBeenCalledOnce();
    // A fresh warm() creates a new session.
    await life.warm();
    expect(api.createCount()).toBe(2);
  });
});
