import { CAPTURE_MESSAGE, requireRuntimeStatus } from "../contracts/messages";
import { installCardButtons } from "./card-buttons";
import { findMaimaiCards, parseMaimaiCard } from "../maimai/card-parser";
import {
  installCollectorToggle,
  type StorageChangeListener,
} from "./collector-toggle";

type SendMessage = (message: unknown) => Promise<unknown>;

export function installMaimaiCardButtons(
  root: Document,
  sendMessage: SendMessage,
): () => void {
  return installCardButtons({
    root,
    findCards: findMaimaiCards,
    parseCard: parseMaimaiCard,
    capture: async (capture) => {
      const response = await sendMessage({ type: CAPTURE_MESSAGE, capture });
      requireRuntimeStatus(response, "stored");
    },
  });
}

declare const chrome:
  | {
      runtime: { sendMessage: SendMessage };
      storage: {
        local: { get: (key: string) => Promise<Record<string, unknown>> };
        onChanged: {
          addListener: (listener: StorageChangeListener) => void;
          removeListener: (listener: StorageChangeListener) => void;
        };
      };
    }
  | undefined;

if (typeof chrome !== "undefined") {
  void installCollectorToggle({
    storage: chrome.storage.local,
    changes: chrome.storage.onChanged,
    install: () =>
      installMaimaiCardButtons(
        document,
        chrome.runtime.sendMessage.bind(chrome.runtime),
      ),
  });
}
