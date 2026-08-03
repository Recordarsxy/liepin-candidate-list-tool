import { PAIR_MESSAGE, requireRuntimeStatus } from "../contracts/messages";
import { COLLECTOR_ENABLED_KEY } from "../content/collector-toggle";
import {
  EDITABLE_FIELDS,
  ELEVEN_COLUMN_FIELDS,
  FIELD_LABELS,
  configureDingTalk,
  deleteCandidate,
  loadCandidates,
  mergeCandidates,
  saveCandidate,
  syncCandidates,
  type Candidate,
  type FetchLike,
} from "./review";

type Storage = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};
type Dependencies = {
  fetchImpl: FetchLike;
  storage: Storage;
  pair: (code: string) => Promise<unknown>;
};

export async function mountSidePanel(
  root: HTMLElement,
  dependencies: Dependencies,
): Promise<void> {
  const collectorToggle = await renderCollectorToggle(dependencies.storage);
  const stored = await dependencies.storage.get("pairingToken");
  if (typeof stored.pairingToken !== "string") {
    renderPairing(root, dependencies);
    root.prepend(collectorToggle);
    return;
  }
  const token = stored.pairingToken;
  const candidates = await loadCandidates(token, dependencies.fetchImpl);
  const status = document.createElement("p");
  status.dataset.role = "status";
  const toolbar = renderToolbar(candidates, token, dependencies, status);
  const config = renderDingTalkConfig(token, dependencies, status);
  const list = document.createElement("div");
  list.dataset.role = "candidate-list";
  list.append(
    ...candidates.map((candidate) =>
      renderCandidate(candidate, candidates, token, dependencies, status),
    ),
  );
  root.replaceChildren(collectorToggle, toolbar, config, status, list);
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

function renderPairing(root: HTMLElement, dependencies: Dependencies): void {
  const heading = document.createElement("h2");
  heading.textContent = "连接本地助手";
  const input = document.createElement("input");
  input.placeholder = "输入本地助手显示的 6 位配对码";
  input.maxLength = 6;
  const button = document.createElement("button");
  button.dataset.action = "pair";
  button.textContent = "确认配对码";
  button.addEventListener("click", () => {
    void dependencies.pair(input.value).then(() => mountSidePanel(root, dependencies));
  });
  root.replaceChildren(heading, input, button);
}

function renderToolbar(
  candidates: Candidate[],
  token: string,
  dependencies: Dependencies,
  status: HTMLElement,
): HTMLElement {
  const toolbar = document.createElement("section");
  const heading = document.createElement("h1");
  heading.textContent = `候选人待办（${candidates.length}）`;
  const button = document.createElement("button");
  button.dataset.action = "sync-selected";
  button.textContent = "写入钉钉";
  button.addEventListener("click", () => {
    const scope = toolbar.parentElement ?? document;
    const selected = Array.from(
      scope.querySelectorAll<HTMLInputElement>("[data-select-candidate]:checked"),
    ).map((checkbox) => Number(checkbox.dataset.selectCandidate));
    if (!selected.length) {
      status.textContent = "请先选择候选人";
      return;
    }
    void syncCandidates(selected, token, dependencies.fetchImpl)
      .then(() => {
        status.textContent = `已处理 ${selected.length} 名候选人`;
      })
      .catch((error: Error) => {
        status.textContent = error.message;
      });
  });
  toolbar.append(heading, button);
  return toolbar;
}

function renderDingTalkConfig(
  token: string,
  dependencies: Dependencies,
  status: HTMLElement,
): HTMLElement {
  const section = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "钉钉配置与权限检查";
  const names = [
    ["client_id", "Client ID"],
    ["client_secret", "Client Secret"],
    ["operator_union_id", "操作人 Union ID"],
    ["workbook_id", "表格 Workbook ID"],
    ["sheet_id", "工作表名称或 ID"],
  ] as const;
  const inputs = names.map(([name, labelText]) => {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.name = name;
    input.type = name === "client_secret" ? "password" : "text";
    label.append(input);
    section.append(label);
    return input;
  });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "保存并检查权限";
  button.addEventListener("click", () => {
    const config = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
    void configureDingTalk(config, token, dependencies.fetchImpl)
      .then(() => {
        status.textContent = "钉钉配置和 11 列表头检查通过";
      })
      .catch((error: Error) => {
        status.textContent = error.message;
      });
  });
  section.prepend(summary);
  section.append(button);
  return section;
}

function renderCandidate(
  candidate: Candidate,
  allCandidates: Candidate[],
  token: string,
  dependencies: Dependencies,
  status: HTMLElement,
): HTMLElement {
  const card = document.createElement("section");
  card.className = "candidate-card";
  card.dataset.candidateId = String(candidate.candidateId);
  const select = document.createElement("input");
  select.type = "checkbox";
  select.dataset.selectCandidate = String(candidate.candidateId);
  const heading = document.createElement("strong");
  heading.textContent = `#${candidate.candidateId} ${candidate.fields.name || "未命名"}`;
  card.append(select, heading);
  for (const field of ELEVEN_COLUMN_FIELDS) {
    const label = document.createElement("label");
    label.textContent = FIELD_LABELS[field];
    const input = document.createElement("input");
    input.dataset.candidateField = field;
    input.value = candidate.fields[field];
    input.disabled = field === "source";
    input.addEventListener("input", () => {
      candidate.fields[field] = input.value;
    });
    label.append(input);
    card.append(label);
  }
  if (candidate.possibleDuplicateIds.length) {
    const warning = document.createElement("p");
    warning.textContent = `疑似重复：${candidate.possibleDuplicateIds
      .map((id) => `#${id}`)
      .join("、")}`;
    card.append(warning);
    for (const possibleId of candidate.possibleDuplicateIds) {
      const merge = document.createElement("button");
      merge.textContent = `人工合并到 #${possibleId}`;
      merge.addEventListener("click", () => {
        const target = allCandidates.find((item) => item.candidateId === possibleId);
        if (!target) return;
        const resolutions = conflictResolutions(target, candidate);
        if (resolutions === null) return;
        void mergeCandidates(possibleId, candidate.candidateId, resolutions, token, dependencies.fetchImpl)
          .then(() => card.remove())
          .catch((error: Error) => {
            status.textContent = error.message;
          });
      });
      card.append(merge);
    }
  }
  const save = document.createElement("button");
  save.textContent = "保存修改";
  save.addEventListener("click", () => {
    void saveCandidate(candidate, token, dependencies.fetchImpl)
      .then(() => {
        status.textContent = `候选人 #${candidate.candidateId} 已保存`;
      })
      .catch((error: Error) => {
        status.textContent = error.message;
      });
  });
  const remove = document.createElement("button");
  remove.textContent = "删除";
  remove.addEventListener("click", () => {
    void deleteCandidate(candidate.candidateId, token, dependencies.fetchImpl)
      .then(() => card.remove())
      .catch((error: Error) => {
        status.textContent = error.message;
      });
  });
  card.append(save, remove);
  return card;
}

function conflictResolutions(
  target: Candidate,
  source: Candidate,
): Record<string, string> | null {
  const resolutions: Record<string, string> = {};
  for (const field of EDITABLE_FIELDS) {
    const left = target.fields[field];
    const right = source.fields[field];
    if (!left || !right || left === right) continue;
    const choice = globalThis.prompt(
      `${FIELD_LABELS[field]}冲突，请输入最终值：\n1. ${left}\n2. ${right}`,
      left,
    );
    if (choice === null) return null;
    resolutions[field] = choice;
  }
  return resolutions;
}

declare const chrome:
  | {
      storage: { local: Storage };
      runtime: { sendMessage: (message: unknown) => Promise<unknown> };
    }
  | undefined;

const root = document.getElementById("app");
if (root && typeof chrome !== "undefined") {
  void mountSidePanel(root, {
    fetchImpl: globalThis.fetch,
    storage: chrome.storage.local,
    pair: async (code) => {
      const response = await chrome.runtime.sendMessage({ type: PAIR_MESSAGE, code });
      requireRuntimeStatus(response, "paired");
    },
  });
}
