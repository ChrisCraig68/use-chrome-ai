import { getGlobal } from "../availability";
import {
  type AiCtor,
  runCall,
  SessionLifecycle,
  store,
  streamCall,
  type TaskController,
} from "../lifecycle";

/** Config for a request/response + streaming API (Summarizer, Writer, Rewriter, Translator). */
export interface TaskConfig<TSession, TParams> {
  api: string;
  globalName: string;
  createOptions: () => Record<string, unknown>;
  availabilityOptions?: () => Record<string, unknown> | undefined;
  run: (session: TSession, params: TParams, signal?: AbortSignal) => Promise<string>;
  stream: (
    session: TSession,
    params: TParams,
    opts: { signal?: AbortSignal },
  ) => ReadableStream<string>;
}

/** Build a {@link TaskController} from a per-API config. Create-time options are
 *  pinned at construction; vary them by constructing another controller. */
export function createTaskController<TSession, TParams>(
  cfg: TaskConfig<TSession, TParams>,
): TaskController<TParams> {
  const life = new SessionLifecycle<TSession>({
    api: cfg.api,
    getCtor: () => getGlobal<AiCtor<TSession>>(cfg.globalName),
    createOptions: cfg.createOptions,
    availabilityOptions: cfg.availabilityOptions,
  });
  return {
    ...store(life),
    run: (params, signal) => runCall(life, (s) => cfg.run(s, params, signal), signal),
    stream: (params, signal) =>
      streamCall(life, (s) => cfg.stream(s, params, signal ? { signal } : {}), signal),
  };
}
