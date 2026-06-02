import { afterEach, describe, expect, it, vi } from "vitest";
import { createChat } from "../src/chat";
import { ContextFullError } from "../src/types";
import { installGlobal, makeFakeApi } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

async function drain(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("createChat", () => {
  it("streams a reply and accumulates the transcript", async () => {
    const api = makeFakeApi({ deltas: ["Hi", " there"] });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));
    const chat = createChat({ system: "be nice" });

    expect(await drain(chat.send("hello"))).toBe("Hi there");
    expect(chat.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hi there" },
    ]);

    // The system prompt is at index 0 of initialPrompts.
    const createArg = api.Ctor.create.mock.calls[0][0] as { initialPrompts: Array<{ role: string }> };
    expect(createArg.initialPrompts[0]).toEqual({ role: "system", content: "be nice" });
  });

  it("reuses one session across turns (context retained)", async () => {
    const api = makeFakeApi({ deltas: ["ok"] });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));
    const chat = createChat();
    await drain(chat.send("one"));
    await drain(chat.send("two"));
    expect(api.createCount()).toBe(1); // single session for the whole conversation
    expect(chat.messages).toHaveLength(4);
  });

  it("maps QuotaExceededError to ContextFullError", async () => {
    const api = makeFakeApi({
      deltas: [],
      failStreamWith: () => new DOMException("full", "QuotaExceededError"),
    });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));
    const chat = createChat();
    await expect(drain(chat.send("x"))).rejects.toBeInstanceOf(ContextFullError);
  });

  it("reset() clears the transcript and reopens a session", async () => {
    const api = makeFakeApi({ deltas: ["a"] });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));
    const chat = createChat();
    await drain(chat.send("hi"));
    chat.reset();
    expect(chat.messages).toEqual([]);
    await drain(chat.send("again"));
    expect(api.createCount()).toBe(2);
  });
});
