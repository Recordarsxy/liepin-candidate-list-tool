import type { CandidateDraft } from "../contracts/candidate";
import { PageBatchSelection } from "./page-batch-selection";

type Options = {
  root: Document;
  findCards: (root: ParentNode) => HTMLElement[];
  parseCard: (card: HTMLElement) => CandidateDraft | null;
  copy: (text: string) => Promise<void>;
  mountButton?: (card: HTMLElement, button: HTMLButtonElement) => void;
};

const BUTTON_ATTRIBUTE = "data-candidate-collector-button";
const SELECTED_ATTRIBUTE = "data-candidate-collector-selected";
const BATCH_ATTRIBUTE = "data-candidate-collector-batch";
const MOUNTED_ATTRIBUTE = "data-candidate-collector-mounted";

export function installCardButtons(options: Options): () => void {
  const selection = new PageBatchSelection();
  let toolbar: HTMLElement | undefined;

  const clearSelection = () => {
    selection.clear();
    options.root
      .querySelectorAll<HTMLButtonElement>(`[${SELECTED_ATTRIBUTE}="true"]`)
      .forEach((button) => {
        button.removeAttribute(SELECTED_ATTRIBUTE);
        button.textContent = "加入批量";
        button.title = "";
        button.disabled = false;
      });
    toolbar?.remove();
    toolbar = undefined;
  };

  const renderToolbar = () => {
    if (selection.size === 0) {
      toolbar?.remove();
      toolbar = undefined;
      return;
    }
    if (!toolbar) {
      toolbar = createToolbar(options, selection, clearSelection);
      options.root.body.append(toolbar);
    }
    const count = toolbar.querySelector<HTMLElement>("[data-role='batch-count']");
    if (count) count.textContent = `已选 ${selection.size} 人`;
    const copyButton = toolbar.querySelector<HTMLButtonElement>(
      "[data-action='copy-batch']",
    );
    if (copyButton) {
      copyButton.textContent = "复制全部";
      copyButton.title = "";
      copyButton.disabled = false;
    }
  };

  const scan = () => {
    for (const card of options.findCards(options.root)) {
      if (
        card.hasAttribute(MOUNTED_ATTRIBUTE) ||
        card.querySelector(`[${BUTTON_ATTRIBUTE}]`)
      ) {
        continue;
      }
      const button = options.root.createElement("button");
      button.type = "button";
      button.setAttribute(BUTTON_ATTRIBUTE, "true");
      button.textContent = "加入批量";
      button.style.cssText =
        "margin:6px;padding:4px 10px;border:1px solid #1677ff;border-radius:4px;" +
        "background:#1677ff;color:white;cursor:pointer;position:relative;" +
        "transform:translateX(-24px);z-index:1";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const draft = options.parseCard(card);
        if (!draft) {
          button.textContent = "暂时无法识别";
          button.disabled = true;
          return;
        }
        const selected = selection.toggle(draft);
        button.textContent = selected ? "已选择" : "加入批量";
        button.title = "";
        button.disabled = false;
        if (selected) button.setAttribute(SELECTED_ATTRIBUTE, "true");
        else button.removeAttribute(SELECTED_ATTRIBUTE);
        renderToolbar();
      });
      if (options.mountButton) options.mountButton(card, button);
      else card.append(button);
      card.setAttribute(MOUNTED_ATTRIBUTE, "true");
    }
  };

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(options.root.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    clearSelection();
    options.root
      .querySelectorAll(`[${BUTTON_ATTRIBUTE}]`)
      .forEach((button) => button.remove());
    options.root
      .querySelectorAll(`[${MOUNTED_ATTRIBUTE}]`)
      .forEach((card) => card.removeAttribute(MOUNTED_ATTRIBUTE));
  };
}

function createToolbar(
  options: Options,
  selection: PageBatchSelection,
  clearSelection: () => void,
): HTMLElement {
  const toolbar = options.root.createElement("section");
  toolbar.setAttribute(BATCH_ATTRIBUTE, "true");
  toolbar.style.cssText =
    "position:fixed;right:24px;bottom:24px;z-index:900;display:flex;" +
    "align-items:center;gap:8px;padding:10px 12px;border:1px solid #d9d9d9;" +
    "border-radius:8px;background:white;box-shadow:0 4px 16px rgba(0,0,0,.16);" +
    "font:14px/1.4 system-ui,sans-serif;color:#222";

  const count = options.root.createElement("strong");
  count.dataset.role = "batch-count";
  const copyButton = options.root.createElement("button");
  copyButton.type = "button";
  copyButton.dataset.action = "copy-batch";
  copyButton.textContent = "复制全部";
  copyButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = selection.toClipboardText();
    if (!text) return;
    copyButton.textContent = "复制中…";
    copyButton.title = "";
    copyButton.disabled = true;
    void options
      .copy(text)
      .then(clearSelection)
      .catch((error: unknown) => {
        copyButton.textContent = "重试";
        copyButton.title =
          error instanceof Error ? error.message : "无法写入剪贴板";
        copyButton.disabled = false;
      });
  });

  const clearButton = options.root.createElement("button");
  clearButton.type = "button";
  clearButton.dataset.action = "clear-batch";
  clearButton.textContent = "清空";
  clearButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearSelection();
  });

  toolbar.append(count, copyButton, clearButton);
  return toolbar;
}
