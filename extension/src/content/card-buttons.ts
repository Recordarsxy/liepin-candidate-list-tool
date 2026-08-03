import type { CandidateDraft } from "../contracts/candidate";

type Options = {
  root: Document;
  findCards: (root: ParentNode) => HTMLElement[];
  parseCard: (card: HTMLElement) => CandidateDraft | null;
  capture: (draft: CandidateDraft) => Promise<void>;
};

const BUTTON_ATTRIBUTE = "data-candidate-collector-button";

export function installCardButtons(options: Options): () => void {
  const scan = () => {
    for (const card of options.findCards(options.root)) {
      if (card.querySelector(`[${BUTTON_ATTRIBUTE}]`)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(BUTTON_ATTRIBUTE, "true");
      button.textContent = "加入待办";
      button.style.cssText =
        "margin:6px;padding:4px 10px;border:1px solid #1677ff;border-radius:4px;" +
        "background:#1677ff;color:white;cursor:pointer;z-index:2147483647";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void captureCard(card, button, options);
      });
      card.append(button);
    }
  };
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(options.root.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    options.root
      .querySelectorAll(`[${BUTTON_ATTRIBUTE}]`)
      .forEach((button) => button.remove());
  };
}

async function captureCard(
  card: HTMLElement,
  button: HTMLButtonElement,
  options: Options,
): Promise<void> {
  const draft = options.parseCard(card);
  if (!draft) {
    button.textContent = "暂时无法识别";
    button.disabled = true;
    return;
  }
  button.textContent = "加入中…";
  button.title = "";
  button.disabled = true;
  try {
    await options.capture(draft);
    button.textContent = "已加入";
  } catch (error: unknown) {
    button.textContent = "重试";
    button.title = error instanceof Error ? error.message : "本地助手请求失败";
    button.disabled = false;
  }
}
