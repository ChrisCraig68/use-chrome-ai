import { useCallback } from "react";
import { createTranslator, type TranslateParams, type TranslatorPair } from "use-chrome-ai";
import { optionsKey, type TaskHook, useController, useTask } from "./internal";

export interface TranslatorHook extends TaskHook<TranslateParams> {
  /** Translate text from source to target language, streaming into `result`. */
  translate: (text: string) => Promise<string>;
}

export function useTranslator(pair: TranslatorPair): TranslatorHook {
  const controller = useController(() => createTranslator(pair), optionsKey("translator", pair));
  const task = useTask<TranslateParams>(controller);
  const translate = useCallback((text: string) => task.stream({ text }), [task.stream]);
  return { ...task, translate };
}
