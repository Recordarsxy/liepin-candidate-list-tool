import { COLLECTOR_ENABLED_KEY } from "../content/collector-toggle";

type Storage = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

type Dependencies = {
  storage: Storage;
};

export async function mountSidePanel(
  root: HTMLElement,
  dependencies: Dependencies,
): Promise<void> {
  const toggle = await renderCollectorToggle(dependencies.storage);
  const heading = document.createElement("h1");
  heading.textContent = "候选人复制工具";
  const instructions = document.createElement("p");
  instructions.textContent =
    "依次点击猎聘或脉脉卡片上的“加入批量”，再点击页面批量栏中的“复制全部”，最后到钉钉表格第一列粘贴。复制成功后页面选择会自动清空，缺失字段保持空白。";
  root.replaceChildren(toggle, heading, instructions);
}

async function renderCollectorToggle(storage: Storage): Promise<HTMLElement> {
  const wrapper = document.createElement("section");
  const button = document.createElement("button");
  const error = document.createElement("span");
  error.dataset.role = "collector-toggle-error";
  button.type = "button";
  button.dataset.action = "toggle-collector";
  const stored = await storage
    .get(COLLECTOR_ENABLED_KEY)
    .catch((): Record<string, unknown> => ({}));
  let enabled = stored[COLLECTOR_ENABLED_KEY] !== false;
  const render = () => {
    button.textContent = enabled ? "采集已开启" : "采集已关闭";
    button.setAttribute("aria-pressed", String(enabled));
  };
  render();
  button.addEventListener("click", () => {
    const next = !enabled;
    button.disabled = true;
    error.textContent = "";
    void storage
      .set({ [COLLECTOR_ENABLED_KEY]: next })
      .then(() => {
        enabled = next;
        render();
      })
      .catch(() => {
        error.textContent = "无法保存采集开关状态";
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  wrapper.append(button, error);
  return wrapper;
}

declare const chrome:
  | {
      storage: { local: Storage };
    }
  | undefined;

const root = document.getElementById("app");
if (root && typeof chrome !== "undefined") {
  void mountSidePanel(root, { storage: chrome.storage.local });
}
