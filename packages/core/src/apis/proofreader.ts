import { getGlobal } from "../availability";
import { type AiCtor, type BaseController, SessionLifecycle, runCall, store } from "../lifecycle";

/** The current spec field is `types` (a list of {@link CorrectionType}), present only
 *  when `includeCorrectionTypes` is enabled — which the current origin trial does NOT
 *  yet support, so in practice `types` and `explanation` are usually absent. */
export type CorrectionType =
  | "spelling"
  | "punctuation"
  | "capitalization"
  | "preposition"
  | "missing-words"
  | "grammar";

export interface Correction {
  startIndex: number;
  endIndex: number;
  /** The replacement text for `input.slice(startIndex, endIndex)`. */
  correction: string;
  /** Categories for this edit. Often absent (see note above). Passed through as-is. */
  types?: string[];
  explanation?: string;
}

export interface ProofreadResult {
  correctedInput: string;
  corrections: Correction[];
}

interface RawCorrection {
  startIndex: number;
  endIndex: number;
  correction: string;
  /** Current spec. */
  types?: string[];
  /** Legacy single-value form, tolerated for older Chrome builds. */
  type?: string;
  explanation?: string;
}

interface ProofreaderSession {
  proofread(
    text: string,
    opts?: { signal?: AbortSignal },
  ): Promise<{ correctedInput: string; corrections: RawCorrection[] }>;
  destroy?(): void;
}

export interface ProofreaderOptions {
  expectedInputLanguages?: string[];
  /** Not yet supported in the current Chrome origin trial; off by default. */
  includeCorrectionTypes?: boolean;
  includeCorrectionExplanations?: boolean;
  correctionExplanationLanguage?: string;
}

export interface ProofreaderController extends BaseController {
  /** Proofread text. Calls are serialized — the on-device session handles one at a time. */
  proofread(text: string, signal?: AbortSignal): Promise<ProofreadResult>;
}

function normalize(c: RawCorrection): Correction {
  const out: Correction = {
    startIndex: c.startIndex,
    endIndex: c.endIndex,
    correction: c.correction,
  };
  // Honor the current `types` array; fall back to the legacy singular `type`.
  if (Array.isArray(c.types) && c.types.length) out.types = c.types;
  else if (typeof c.type === "string") out.types = [c.type];
  if (c.explanation) out.explanation = c.explanation;
  return out;
}

export function createProofreader(options: ProofreaderOptions = {}): ProofreaderController {
  const life = new SessionLifecycle<ProofreaderSession>({
    api: "Proofreader",
    getCtor: () => getGlobal<AiCtor<ProofreaderSession>>("Proofreader"),
    createOptions: () => ({
      expectedInputLanguages: options.expectedInputLanguages ?? ["en"],
      ...(options.includeCorrectionTypes !== undefined
        ? { includeCorrectionTypes: options.includeCorrectionTypes }
        : {}),
      ...(options.includeCorrectionExplanations !== undefined
        ? { includeCorrectionExplanations: options.includeCorrectionExplanations }
        : {}),
      ...(options.correctionExplanationLanguage
        ? { correctionExplanationLanguage: options.correctionExplanationLanguage }
        : {}),
    }),
    availabilityOptions: () => ({ expectedInputLanguages: options.expectedInputLanguages ?? ["en"] }),
  });

  // The on-device proofreader processes one proofread() at a time; overlapping calls
  // on the shared session collide. Serialize them through a promise chain.
  let queue: Promise<unknown> = Promise.resolve();

  function proofread(text: string, signal?: AbortSignal): Promise<ProofreadResult> {
    const run = queue.then(() => {
      // A request superseded while waiting its turn should never reach the model.
      signal?.throwIfAborted();
      return runCall(
        life,
        async (s) => {
          const r = await s.proofread(text, signal ? { signal } : undefined);
          return { correctedInput: r.correctedInput, corrections: r.corrections.map(normalize) };
        },
        signal,
      );
    });
    // Advance the chain regardless of outcome so one failure doesn't stall the queue.
    queue = run.catch(() => {});
    return run;
  }

  return { ...store(life), proofread };
}
