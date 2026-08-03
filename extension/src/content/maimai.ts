import { findMaimaiCards, parseMaimaiCard } from "../maimai/card-parser";
import { installCardButtons } from "./card-buttons";
import {
  installCollectorToggle,
  type StorageChangeListener,
} from "./collector-toggle";

type WriteText = (text: string) => Promise<void>;

export function installMaimaiCardButtons(
  root: Document,
  writeText: WriteText,
): () => void {
  return installCardButtons({
    root,
    findCards: findMaimaiCards,
    parseCard: parseMaimaiCard,
    copy: writeText,
  });
}

declare const chrome:
  | {
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
        navigator.clipboard.writeText.bind(navigator.clipboard),
      ),
  });
}
