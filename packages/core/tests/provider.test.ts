import { afterEach, describe, expect, it } from "vitest";
// Everything comes through the public entry point so these tests also pin the exports.
import {
  ActivationRequiredError,
  type BuiltInAiApi,
  BuiltInAiError,
  type ChromeAiApi,
  ChromeAiError,
  ContextFullError,
  detectBrowser,
  UnavailableError,
} from "../src/index";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** Shadow navigator properties on the instance (happy-dom defines them on the
 *  prototype). Returns an uninstaller. */
function setNavigator(props: { userAgentData?: unknown; userAgent?: unknown }): () => void {
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  const prev = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(props)) {
    prev.set(key, Object.getOwnPropertyDescriptor(nav, key));
    Object.defineProperty(nav, key, { value, configurable: true, writable: true });
  }
  return () => {
    for (const [key, desc] of prev) {
      if (desc) Object.defineProperty(nav, key, desc);
      else delete nav[key];
    }
  };
}

describe("detectBrowser", () => {
  it("identifies Edge from userAgentData brands", () => {
    cleanups.push(
      setNavigator({
        userAgentData: {
          brands: [
            { brand: "Chromium", version: "138" },
            { brand: "Microsoft Edge", version: "138" },
            { brand: "Not.A/Brand", version: "99" },
          ],
        },
      }),
    );
    expect(detectBrowser()).toBe("edge");
  });

  it("identifies Chrome from userAgentData brands", () => {
    cleanups.push(
      setNavigator({
        userAgentData: {
          brands: [
            { brand: "Google Chrome", version: "138" },
            { brand: "Chromium", version: "138" },
          ],
        },
      }),
    );
    expect(detectBrowser()).toBe("chrome");
  });

  it("reports other Chromium browsers (e.g. Brave) as 'chromium'", () => {
    cleanups.push(
      setNavigator({
        userAgentData: {
          brands: [
            { brand: "Brave", version: "138" },
            { brand: "Chromium", version: "138" },
          ],
        },
      }),
    );
    expect(detectBrowser()).toBe("chromium");
  });

  it("falls back to the UA string — Edge before Chrome (Edge UAs contain both)", () => {
    cleanups.push(
      setNavigator({
        userAgentData: undefined,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
      }),
    );
    expect(detectBrowser()).toBe("edge");
  });

  it("falls back to the UA string — plain Chrome", () => {
    cleanups.push(
      setNavigator({
        userAgentData: undefined,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      }),
    );
    expect(detectBrowser()).toBe("chrome");
  });

  it("falls back to the UA string — Opera-style forks report 'chromium'", () => {
    cleanups.push(
      setNavigator({
        userAgentData: undefined,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/120.0.0.0",
      }),
    );
    expect(detectBrowser()).toBe("chromium");
  });

  it("degrades to 'unknown' (never throws) on malformed navigator shapes", () => {
    // e.g. a UA-spoofing extension or sloppy test shim installing non-spec values.
    cleanups.push(setNavigator({ userAgentData: { brands: {} }, userAgent: 42 }));
    expect(detectBrowser()).toBe("unknown");
  });

  it("tolerates junk entries inside userAgentData.brands", () => {
    cleanups.push(
      setNavigator({
        userAgentData: { brands: [null, "junk", { brand: "Microsoft Edge", version: "150" }] },
        userAgent: "",
      }),
    );
    expect(detectBrowser()).toBe("edge");
  });

  it("returns 'unknown' when navigator is absent entirely (SSR/workers)", () => {
    const prev = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
    cleanups.push(() => {
      if (prev) Object.defineProperty(globalThis, "navigator", prev);
      else delete (globalThis as Record<string, unknown>).navigator;
    });
    expect(detectBrowser()).toBe("unknown");
  });

  it("returns 'unknown' for non-Chromium browsers", () => {
    cleanups.push(
      setNavigator({
        userAgentData: undefined,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      }),
    );
    expect(detectBrowser()).toBe("unknown");
  });
});

describe("browser-neutral error names (back-compat aliases)", () => {
  it("ChromeAiError is the same class as BuiltInAiError", () => {
    expect(ChromeAiError).toBe(BuiltInAiError);
    const err = new UnavailableError("Summarizer");
    expect(err).toBeInstanceOf(BuiltInAiError);
    expect(err).toBeInstanceOf(ChromeAiError);
    expect(err).toBeInstanceOf(Error);
  });

  it("subclass names are unchanged (docs tell users to branch on error.name)", () => {
    expect(new UnavailableError("X").name).toBe("UnavailableError");
    expect(new ActivationRequiredError("X").name).toBe("ActivationRequiredError");
    expect(new ContextFullError().name).toBe("ContextFullError");
  });

  it("UnavailableError message is browser-neutral (names Edge alongside Chrome)", () => {
    const message = new UnavailableError("Summarizer").message;
    expect(message).toContain("Chrome");
    expect(message).toContain("Edge");
  });

  it("ChromeAiApi remains assignable to/from BuiltInAiApi", () => {
    const legacy: ChromeAiApi = "summarizer";
    const current: BuiltInAiApi = legacy;
    expect(current).toBe("summarizer");
  });
});
