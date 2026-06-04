import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanguageDetector } from "../src/apis/languageDetector";
import { createLanguageModel } from "../src/apis/languageModel";
import { createProofreader } from "../src/apis/proofreader";
import { createSummarizer } from "../src/apis/summarizer";
import { isAbortError } from "../src/stream";
import { ActivationRequiredError } from "../src/types";
import { installGlobal, makeFakeApi, setUserActivation } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("per-API factories", () => {
  it("summarizer streams deltas into a full string", async () => {
    const api = makeFakeApi({ deltas: ["Sum", "mary"] });
    cleanups.push(installGlobal("Summarizer", api.Ctor));
    const s = createSummarizer({ type: "tldr" });
    expect(await collect(s.stream({ text: "long text" }))).toBe("Summary");
    // The configured create options are passed through.
    expect(api.Ctor.create).toHaveBeenCalledOnce();
    expect(api.Ctor.create.mock.calls[0][0]).toMatchObject({
      type: "tldr",
      expectedInputLanguages: ["en"],
      outputLanguage: "en",
    });
  });

  it("summarizer run() returns the full (non-streaming) result", async () => {
    const api = makeFakeApi({ result: "TLDR" });
    cleanups.push(installGlobal("Summarizer", api.Ctor));
    const s = createSummarizer();
    expect(await s.run({ text: "x" })).toBe("TLDR");
  });

  it("a normal call never auto-downloads — stream() throws ActivationRequiredError when downloadable", async () => {
    // Even with a user gesture present, the call must not silently pull the model.
    cleanups.push(setUserActivation(true));
    const api = makeFakeApi({ availability: "downloadable" });
    cleanups.push(installGlobal("Summarizer", api.Ctor));
    const s = createSummarizer();
    let caught: unknown;
    try {
      await collect(s.stream({ text: "x" }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ActivationRequiredError);
    expect(api.createCount()).toBe(0); // nothing was created/downloaded
  });

  it("languageModel prompts on a throwaway clone", async () => {
    const api = makeFakeApi({ result: "answer" });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));
    const lm = createLanguageModel({ system: "be brief" });
    expect(await lm.prompt("q")).toBe("answer");
    const [base, clone] = api.sessions();
    // The warm base session is cloned per call, and the clone is destroyed after.
    expect(base.clone).toHaveBeenCalledOnce();
    expect(clone.destroy).toHaveBeenCalledOnce();
    expect(api.createCount()).toBe(1); // only the base is create()d; the clone is clone()d
  });

  it("proofreader passes correction types through (and tolerates legacy `type`)", async () => {
    const api = makeFakeApi({
      proofreadResult: {
        correctedInput: "fixed",
        corrections: [
          { startIndex: 0, endIndex: 3, correction: "The", types: ["capitalization"] },
          { startIndex: 4, endIndex: 7, correction: "cat", type: "spelling" }, // legacy singular
          { startIndex: 8, endIndex: 9, correction: "a" }, // no type info
        ],
      },
    });
    cleanups.push(installGlobal("Proofreader", api.Ctor));
    const p = createProofreader();
    const r = await p.proofread("teh cat x");
    expect(r.correctedInput).toBe("fixed");
    expect(r.corrections[0].types).toEqual(["capitalization"]);
    expect(r.corrections[1].types).toEqual(["spelling"]); // wrapped from legacy `type`
    expect(r.corrections[2].types).toBeUndefined();
  });

  it("proofreader serializes overlapping calls", async () => {
    const api = makeFakeApi({ proofreadResult: { correctedInput: "ok", corrections: [] } });
    cleanups.push(installGlobal("Proofreader", api.Ctor));
    const p = createProofreader();
    const order: number[] = [];
    const session = () => api.lastSession();
    await Promise.all([
      p.proofread("a").then(() => order.push(1)),
      p.proofread("b").then(() => order.push(2)),
      p.proofread("c").then(() => order.push(3)),
    ]);
    expect(order).toEqual([1, 2, 3]); // resolved in submission order
    // One shared session, called three times.
    expect(session()?.proofread).toHaveBeenCalledTimes(3);
  });

  it("languageDetector returns ranked results", async () => {
    const api = makeFakeApi({
      detectResult: [
        { detectedLanguage: "en", confidence: 0.9 },
        { detectedLanguage: "fr", confidence: 0.1 },
      ],
    });
    cleanups.push(installGlobal("LanguageDetector", api.Ctor));
    const d = createLanguageDetector();
    const r = await d.detect("hello world");
    expect(r[0].detectedLanguage).toBe("en");
  });

  it("aborting a stream throws AbortError and does NOT invalidate", async () => {
    const api = makeFakeApi({ deltas: ["a", "b"] });
    cleanups.push(installGlobal("Summarizer", api.Ctor));
    const s = createSummarizer();
    const ac = new AbortController();
    ac.abort();
    let caught: unknown;
    try {
      await collect(s.stream({ text: "x" }, ac.signal));
    } catch (err) {
      caught = err;
    }
    expect(isAbortError(caught)).toBe(true);
    // No second availability re-check from invalidate(): only the initial one (none yet).
    expect(api.createCount()).toBe(0); // warm() never created — aborted up front
  });
});
