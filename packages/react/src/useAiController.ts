import type { BaseController } from "use-chrome-ai";
import { type AiStatus, useAiStatus, useController } from "./internal";

/**
 * Escape hatch: own any core controller and get its status, with full access to the
 * controller for methods the dedicated hooks don't surface (e.g. structured-output
 * prompting, raw `warm()`, the live session). Re-creates the controller when `key`
 * changes — pass a stable key derived from your options.
 *
 * ```ts
 * const { controller, isReady } = useAiController(
 *   () => createLanguageModel({ system }), `lm:${system}`
 * );
 * await controller.prompt("…", { responseConstraint: schema });
 * ```
 */
export function useAiController<T extends BaseController>(
  make: () => T,
  key: string,
): AiStatus & { controller: T } {
  const controller = useController(make, key);
  return { ...useAiStatus(controller), controller };
}
