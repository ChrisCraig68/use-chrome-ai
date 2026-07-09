/** Best-effort identity of the host browser, for tailoring setup instructions or UX copy
 *  (e.g. linking Chrome's vs Edge's built-in AI docs). "chromium" is another
 *  Chromium-based browser (Brave, Opera, …); "unknown" is everything else. */
export type AiBrowser = "chrome" | "edge" | "chromium" | "unknown";

/**
 * Identify which browser this is, so an app can point users at the right enablement
 * steps or name the right on-device model. This is NOT feature detection — gate features
 * on `isApiSupported()` / `availability()`, never on the browser name. Any browser
 * that ships the standardized globals works regardless of what this returns.
 */
export function detectBrowser(): AiBrowser {
  const nav = (
    globalThis as {
      navigator?: {
        userAgentData?: { brands?: unknown };
        userAgent?: unknown;
      };
    }
  ).navigator;
  // Type-check host reads, don't just null-check: a UA-spoofing extension or test shim
  // can install non-spec shapes, and best-effort means degrading to "unknown", not throwing.
  const rawBrands = nav?.userAgentData?.brands;
  const brands = Array.isArray(rawBrands)
    ? (rawBrands as Array<{ brand?: unknown } | null | undefined>).map((b) => b?.brand)
    : [];
  // Order matters: every Chromium browser also lists the "Chromium" brand.
  if (brands.includes("Microsoft Edge")) return "edge";
  if (brands.includes("Google Chrome")) return "chrome";
  if (brands.includes("Chromium")) return "chromium";
  // UA-string fallback. Edge's UA also contains "Chrome/", so check "Edg/" first;
  // other Chromium forks (e.g. Opera's "OPR/") also contain "Chrome/".
  const ua = typeof nav?.userAgent === "string" ? nav.userAgent : "";
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("OPR/")) return "chromium";
  if (ua.includes("Chrome/")) return "chrome";
  return "unknown";
}
