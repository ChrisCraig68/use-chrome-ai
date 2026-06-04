import { getGlobal } from "../availability";
import { type AiCtor, type BaseController, runCall, SessionLifecycle, store } from "../lifecycle";

export interface DetectResult {
  /** BCP-47 language tag, or "und" when undetermined. */
  detectedLanguage: string;
  /** 0..1. Results are returned ranked, most-confident first. */
  confidence: number;
}

interface LanguageDetectorSession {
  detect(text: string, opts?: { signal?: AbortSignal }): Promise<DetectResult[]>;
  destroy?(): void;
}

export interface LanguageDetectorOptions {
  expectedInputLanguages?: string[];
}

export interface LanguageDetectorController extends BaseController {
  /** Returns languages ranked by confidence (non-streaming). */
  detect(text: string, signal?: AbortSignal): Promise<DetectResult[]>;
}

export function createLanguageDetector(
  options: LanguageDetectorOptions = {},
): LanguageDetectorController {
  const life = new SessionLifecycle<LanguageDetectorSession>({
    api: "LanguageDetector",
    getCtor: () => getGlobal<AiCtor<LanguageDetectorSession>>("LanguageDetector"),
    createOptions: () => ({
      ...(options.expectedInputLanguages
        ? { expectedInputLanguages: options.expectedInputLanguages }
        : {}),
    }),
  });
  return {
    ...store(life),
    detect: (text, signal) =>
      runCall(life, (s) => s.detect(text, signal ? { signal } : undefined), signal),
  };
}
