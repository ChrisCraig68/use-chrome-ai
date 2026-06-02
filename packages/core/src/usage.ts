/**
 * QUARANTINE: the token/quota surface is the spec-churniest part of the Prompt API.
 * The member names were renamed once already and differ by API family:
 *   - LanguageModel (current):  contextUsage / contextWindow / measureContextUsage()
 *   - LanguageModel (legacy):   inputUsage  / inputQuota    / measureInputUsage()
 *   - Task APIs (Summarizer…):  inputUsage  / inputQuota    / measureInputUsage()
 * We read both families (current first) so any future rename's blast radius is this
 * one file. This is intentionally NOT part of the default hook surface — power users
 * reach a raw session via the escape hatch and call `readUsage(session)`.
 */

export interface UsageInfo {
  /** Tokens currently consumed by the session's context. */
  used: number;
  /** Maximum tokens the session's context can hold. */
  quota: number;
  /** `quota - used`, clamped at 0. */
  remaining: number;
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/** Read a session's context usage if the (volatile) members are present, else null. */
export function readUsage(session: unknown): UsageInfo | null {
  if (!session || typeof session !== "object") return null;
  const s = session as Record<string, unknown>;
  const used = firstNumber(s, ["contextUsage", "inputUsage"]);
  const quota = firstNumber(s, ["contextWindow", "inputQuota"]);
  if (used === null || quota === null) return null;
  return { used, quota, remaining: Math.max(0, quota - used) };
}
