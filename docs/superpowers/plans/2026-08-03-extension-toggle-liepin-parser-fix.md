# Extension Toggle and Liepin Parser Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make real Liepin list cards produce reliable candidate drafts and add a persistent side-panel switch that immediately enables or disables capture buttons on Liepin and Maimai.

**Architecture:** Keep site-specific DOM knowledge in the Liepin adapter, using stable semantic classes plus the visible work/education row structure. Add a small storage-driven content-script controller shared by both sites; the side panel only writes `collectorEnabled`, while open content scripts react through `chrome.storage.onChanged`.

**Tech Stack:** Chrome MV3, TypeScript, Vite, Vitest, jsdom, Chrome `storage.local` API.

## Global Constraints

- Read only information explicitly visible in the current summary card.
- Do not open detail pages, read cookies or network responses, or collect contact details.
- Missing or ambiguous fields must remain empty strings.
- Gender is accepted only when the page explicitly displays `男` or `女`; never infer it from `先生` or `女士`.
- The switch defaults to enabled and persists as `collectorEnabled` in `chrome.storage.local`.
- Disabling capture must not delete pending candidates or DingTalk configuration.
- Do not add Chrome permissions beyond the existing `sidePanel`, `storage`, two recruitment-site matches, and localhost helper access.

---

### Task 1: Reproduce and Fix the Live Liepin Card Parser

**Files:**
- Create: `tests/fixtures/liepin/list-live-structure.html`
- Modify: `extension/src/liepin/card-parser.test.ts`
- Modify: `extension/src/liepin/card-parser.ts`

**Interfaces:**
- Consumes: `parseVisibleCard(card, platform, platformCandidateId)` compatibility behavior from `extension/src/shared/card-fields.ts`.
- Produces: `parseLiepinCard(card: HTMLElement): CandidateDraft | null`, with live-card structural parsing and the existing fixture fallback.

- [ ] **Step 1: Add an anonymous fixture matching the observed live structure**

```html
<div class="tlog-common-resume-card live-card">
  <label class="ant-checkbox-wrapper card-resume-check">
    <input class="ant-checkbox-input" name="res_id_encode" type="checkbox" value="lp-live-1">
  </label>
  <div class="new-resume-personal">
    <div class="new-resume-personal-name"><em>陈女士</em></div>
    <div class="new-resume-personal-detail">
      <span class="personal-detail-age">31岁</span>
      <span class="personal-detail-dq">上海</span>
    </div>
    <div class="new-resume-personal-expect">
      <span class="personal-expect-content"><span>杭州</span><span>机构销售</span></span>
    </div>
  </div>
  <div class="history-row"><p>
    <span>Northwind Capital · 高级客户经理</span>
    <span>2022.05-至今(4年)</span>
  </p></div>
  <div class="history-row"><p>
    <span>Contoso University · 金融学 · 硕士 · 统招</span>
    <span>2019.09-2022.04(3年)</span>
  </p></div>
  <div class="history-row"><p>
    <span>Fabrikam University · 经济学 · 本科 · 统招</span>
    <span>2015.09-2019.06(4年)</span>
  </p></div>
</div>
```

- [ ] **Step 2: Write the failing live-structure parser test**

```ts
import liveFixture from "../../../tests/fixtures/liepin/list-live-structure.html?raw";

it("parses the stable fields and structured history from a live-style card", () => {
  document.body.innerHTML = liveFixture;
  const card = document.querySelector<HTMLElement>(".live-card");
  const parsed = card ? parseLiepinCard(card) : null;

  expect(parsed).toMatchObject({
    platform: "liepin",
    platform_candidate_id: "lp-live-1",
    name: "陈女士",
    gender: "",
    age: "31岁",
    current_location: "上海",
    preferred_location: "杭州",
    current_role: "高级客户经理",
    current_company: "Northwind Capital",
    master_school: "Contoso University",
    bachelor_school: "Fabrikam University",
    bachelor_start_year: "2015",
  });
});
```

- [ ] **Step 3: Run the parser test and verify the expected failure**

Run: `cd extension && npm.cmd test -- --run src/liepin/card-parser.test.ts`

Expected: FAIL because the existing parser cannot find `new-resume-personal-name` or structured history fields and returns `null`.

- [ ] **Step 4: Implement stable-field and history helpers in the Liepin adapter**

```ts
type HistoryEntry = { parts: string[]; period: string };

function visibleText(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return "";
  if (element.hidden || element.closest("[hidden]") || element.style.display === "none") return "";
  return element.textContent?.trim() ?? "";
}

function expectedParts(card: HTMLElement): string[] {
  const container = card.querySelector(".new-resume-personal-expect .personal-expect-content");
  if (!container) return [];
  return Array.from(container.children).map(visibleText).filter(Boolean);
}

function historyEntries(card: HTMLElement): HistoryEntry[] {
  return Array.from(card.querySelectorAll("p"))
    .map((row) => {
      const texts = Array.from(row.children).map(visibleText).filter(Boolean);
      const content = texts.find((text) => text.includes(" · ")) ?? "";
      const period = texts.find((text) => /^(?:19|20)\d{2}[./-]\d{1,2}-/.test(text)) ?? "";
      return { parts: content.split(/\s*·\s*/).filter(Boolean), period };
    })
    .filter((entry) => entry.parts.length >= 2);
}

function parseLiveLiepinCard(card: HTMLElement, id?: string): CandidateDraft | null {
  const name = visibleText(card.querySelector(".new-resume-personal-name em"));
  const expected = expectedParts(card);
  const entries = historyEntries(card);
  const work = entries.find((entry) => !entry.parts.some((part) => ["本科", "硕士", "博士"].includes(part)));
  const master = entries.find((entry) => entry.parts.includes("硕士"));
  const bachelor = entries.find((entry) => entry.parts.includes("本科"));
  if (!name || (!work?.parts[0] && !work?.parts[1] && !expected[1])) return null;
  return {
    platform: "liepin",
    ...(id ? { platform_candidate_id: id } : {}),
    source_page_type: "list",
    current_company: work?.parts[0] ?? "",
    name,
    gender: "",
    age: visibleText(card.querySelector(".personal-detail-age")),
    current_location: visibleText(card.querySelector(".personal-detail-dq")),
    preferred_location: expected[0] ?? "",
    current_role: work?.parts[1] ?? expected[1] ?? "",
    master_school: master?.parts[0] ?? "",
    bachelor_school: bachelor?.parts[0] ?? "",
    bachelor_start_year: bachelor?.period.match(/(?:19|20)\d{2}/)?.[0] ?? "",
  };
}
```

Update `parseLiepinCard` to calculate the checkbox ID once and keep the existing generic fixture fallback:

```ts
export function parseLiepinCard(card: HTMLElement): CandidateDraft | null {
  const id =
    card.dataset.liepinCandidateId?.trim() ||
    card.querySelector<HTMLInputElement>('input[type="checkbox"][value]')?.value.trim();
  return (
    parseLiveLiepinCard(card, id || undefined) ??
    parseVisibleCard(card, "liepin", id || undefined)
  );
}
```

- [ ] **Step 5: Run parser tests and verify green**

Run: `cd extension && npm.cmd test -- --run src/liepin/card-parser.test.ts`

Expected: all tests in `card-parser.test.ts` PASS, including the existing generic fixture tests.

- [ ] **Step 6: Commit only the parser deliverable**

```powershell
git add -- tests/fixtures/liepin/list-live-structure.html extension/src/liepin/card-parser.ts extension/src/liepin/card-parser.test.ts
git commit -m "fix: parse live Liepin candidate cards"
```

---

### Task 2: Add a Shared Storage-Driven Capture Controller

**Files:**
- Create: `extension/src/content/collector-toggle.ts`
- Create: `extension/src/content/collector-toggle.test.ts`
- Modify: `extension/src/content/card-buttons.ts`
- Modify: `extension/src/content/card-buttons.test.ts`
- Modify: `extension/src/content/liepin.ts`
- Modify: `extension/src/content/maimai.ts`

**Interfaces:**
- Consumes: site installers with signature `() => () => void` and Chrome storage change events.
- Produces: `installCollectorToggle(dependencies): Promise<() => void>` and `COLLECTOR_ENABLED_KEY = "collectorEnabled"`.

- [ ] **Step 1: Write a failing cleanup test for card-button disposal**

```ts
it("removes injected buttons when disposed", () => {
  document.body.innerHTML = `<article data-card="1"></article>`;
  const dispose = installCardButtons({
    root: document,
    findCards: (root) => Array.from(root.querySelectorAll<HTMLElement>("[data-card]")),
    parseCard: () => draft,
    capture: vi.fn(),
  });

  dispose();

  expect(document.querySelector("[data-candidate-collector-button]")).toBeNull();
});
```

- [ ] **Step 2: Run the cleanup test and verify red**

Run: `cd extension && npm.cmd test -- --run src/content/card-buttons.test.ts`

Expected: FAIL because the current disposer disconnects the observer but leaves injected buttons in the page.

- [ ] **Step 3: Make the card-button disposer remove only extension-owned buttons**

```ts
return () => {
  observer.disconnect();
  options.root
    .querySelectorAll(`[${BUTTON_ATTRIBUTE}]`)
    .forEach((button) => button.remove());
};
```

- [ ] **Step 4: Run the cleanup test and verify green**

Run: `cd extension && npm.cmd test -- --run src/content/card-buttons.test.ts`

Expected: all card-button tests PASS.

- [ ] **Step 5: Write failing controller tests for default, disable and re-enable**

```ts
it("defaults to enabled and follows local storage changes", async () => {
  const listeners = new Set<StorageChangeListener>();
  const install = vi.fn(() => vi.fn());
  const dispose = await installCollectorToggle({
    storage: { get: vi.fn().mockResolvedValue({}) },
    changes: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
    install,
  });

  expect(install).toHaveBeenCalledTimes(1);
  listeners.forEach((listener) => listener({ collectorEnabled: { newValue: false } }, "local"));
  expect(install.mock.results[0].value).toHaveBeenCalledTimes(1);
  listeners.forEach((listener) => listener({ collectorEnabled: { newValue: true } }, "local"));
  expect(install).toHaveBeenCalledTimes(2);
  dispose();
});
```

- [ ] **Step 6: Run the controller test and verify red**

Run: `cd extension && npm.cmd test -- --run src/content/collector-toggle.test.ts`

Expected: FAIL because `installCollectorToggle` does not exist.

- [ ] **Step 7: Implement the shared controller**

```ts
export const COLLECTOR_ENABLED_KEY = "collectorEnabled";

export type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown }>,
  areaName: string,
) => void;

type Dependencies = {
  storage: { get: (key: string) => Promise<Record<string, unknown>> };
  changes: {
    addListener: (listener: StorageChangeListener) => void;
    removeListener: (listener: StorageChangeListener) => void;
  };
  install: () => () => void;
};

export async function installCollectorToggle(dependencies: Dependencies): Promise<() => void> {
  let stopButtons: (() => void) | undefined;
  const apply = (enabled: boolean) => {
    stopButtons?.();
    stopButtons = enabled ? dependencies.install() : undefined;
  };
  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local" || !(COLLECTOR_ENABLED_KEY in changes)) return;
    apply(changes[COLLECTOR_ENABLED_KEY].newValue !== false);
  };
  const stored = await dependencies.storage.get(COLLECTOR_ENABLED_KEY).catch(() => ({}));
  apply(stored[COLLECTOR_ENABLED_KEY] !== false);
  dependencies.changes.addListener(listener);
  return () => {
    dependencies.changes.removeListener(listener);
    stopButtons?.();
  };
}
```

- [ ] **Step 8: Wire both content scripts through the controller**

Replace direct installation with:

```ts
import {
  installCollectorToggle,
  type StorageChangeListener,
} from "./collector-toggle";

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
    install: () => installLiepinCardButtons(document, chrome.runtime.sendMessage.bind(chrome.runtime)),
  });
}
```

Use `installMaimaiCardButtons` in the Maimai entry point.

- [ ] **Step 9: Run shared content tests and verify green**

Run: `cd extension && npm.cmd test -- --run src/content/card-buttons.test.ts src/content/collector-toggle.test.ts src/content/liepin.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 10: Commit the controller deliverable**

```powershell
git add -- extension/src/content/collector-toggle.ts extension/src/content/collector-toggle.test.ts extension/src/content/card-buttons.ts extension/src/content/card-buttons.test.ts extension/src/content/liepin.ts extension/src/content/maimai.ts
git commit -m "feat: add persistent capture toggle controller"
```

---

### Task 3: Add the Side-Panel Toggle

**Files:**
- Modify: `extension/src/sidepanel/app.ts`
- Modify: `extension/src/sidepanel/app.test.ts`

**Interfaces:**
- Consumes: `COLLECTOR_ENABLED_KEY` from `extension/src/content/collector-toggle.ts` and a storage object with `get` and `set`.
- Produces: a top-of-panel button with `data-action="toggle-collector"` and text `采集已开启` or `采集已关闭`.

- [ ] **Step 1: Extend the side-panel test storage fake and write the failing toggle test**

```ts
it("renders and persists the capture toggle at the top of the panel", async () => {
  const root = document.createElement("main");
  const set = vi.fn().mockResolvedValue(undefined);
  await mountSidePanel(root, {
    fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }),
    storage: {
      get: vi.fn().mockImplementation(async (key: string) =>
        key === "pairingToken" ? { pairingToken: "token-1" } : { collectorEnabled: true },
      ),
      set,
    },
    pair: vi.fn(),
  });

  const toggle = root.querySelector<HTMLButtonElement>("[data-action='toggle-collector']");
  expect(root.firstElementChild).toBe(toggle);
  expect(toggle?.textContent).toBe("采集已开启");
  toggle?.click();
  await vi.waitFor(() => expect(set).toHaveBeenCalledWith({ collectorEnabled: false }));
  expect(toggle?.textContent).toBe("采集已关闭");
});
```

- [ ] **Step 2: Run the side-panel test and verify red**

Run: `cd extension && npm.cmd test -- --run src/sidepanel/app.test.ts`

Expected: FAIL because the storage interface has no `set` and the toggle is absent.

- [ ] **Step 3: Implement the toggle renderer and mount it before all other sections**

```ts
type Storage = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

async function renderCollectorToggle(storage: Storage): Promise<HTMLElement> {
  const wrapper = document.createElement("section");
  const button = document.createElement("button");
  const error = document.createElement("span");
  error.dataset.role = "collector-toggle-error";
  button.type = "button";
  button.dataset.action = "toggle-collector";
  const stored = await storage.get(COLLECTOR_ENABLED_KEY).catch(() => ({}));
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
```

At the start of `mountSidePanel`, await the toggle before checking `pairingToken`; prepend it after `renderPairing` and include it first in the paired layout:

```ts
const collectorToggle = await renderCollectorToggle(dependencies.storage);
const stored = await dependencies.storage.get("pairingToken");
if (typeof stored.pairingToken !== "string") {
  renderPairing(root, dependencies);
  root.prepend(collectorToggle);
  return;
}
// Existing candidate loading and rendering stays unchanged.
root.replaceChildren(collectorToggle, toolbar, config, status, list);
```

- [ ] **Step 4: Update all existing side-panel storage test doubles with `set`**

Add `set: vi.fn().mockResolvedValue(undefined)` to each `storage` test double so the interface matches production.

- [ ] **Step 5: Run side-panel tests and verify green**

Run: `cd extension && npm.cmd test -- --run src/sidepanel/app.test.ts`

Expected: all side-panel tests PASS.

- [ ] **Step 6: Commit the side-panel deliverable**

```powershell
git add -- extension/src/sidepanel/app.ts extension/src/sidepanel/app.test.ts
git commit -m "feat: add side-panel capture switch"
```

---

### Task 4: Full Verification and Installed-Build Refresh

**Files:**
- Modify generated files only: `extension/dist/**`
- Replace installed copies only: `%LOCALAPPDATA%\CandidateCollector\extension\**`
- Replace desktop unpacked copy only: `%USERPROFILE%\Desktop\候选人采集插件\**`

**Interfaces:**
- Consumes: the completed parser, controller and side-panel toggle.
- Produces: a verified production build ready for the user to reload in the browser extension manager.

- [ ] **Step 1: Run the complete extension verification**

Run: `cd extension && npm.cmd test -- --run && npm.cmd run typecheck && npm.cmd run build`

Expected: all Vitest files PASS, TypeScript exits `0`, and Vite produces background, Liepin, Maimai and side-panel bundles.

- [ ] **Step 2: Re-run the extension permission check**

```powershell
$manifest = Get-Content -Raw -Encoding UTF8 extension\manifest.json | ConvertFrom-Json
if ($manifest.permissions -contains 'cookies' -or $manifest.permissions -contains 'webRequest') { throw 'Forbidden permission' }
```

Expected: exits `0` and the manifest still contains only `sidePanel` and `storage` permissions.

- [ ] **Step 3: Copy the verified build to both installed unpacked-extension directories**

```powershell
$source = 'C:\Users\shawnxu\Documents\销售list表格制作\.worktrees\liepin-v1\extension'
$targets = @(
  'C:\Users\shawnxu\AppData\Local\CandidateCollector\extension',
  'C:\Users\shawnxu\Desktop\候选人采集插件'
)
foreach ($target in $targets) {
  Copy-Item -LiteralPath (Join-Path $source 'manifest.json') -Destination $target -Force
  Copy-Item -LiteralPath (Join-Path $source 'sidepanel.html') -Destination $target -Force
  Copy-Item -LiteralPath (Join-Path $source 'dist') -Destination $target -Recurse -Force
}
```

Expected: both targets contain matching `manifest.json`, `sidepanel.html`, `dist/content/liepin.js`, `dist/content/maimai.js`, and `dist/sidepanel/app.js`.

- [ ] **Step 4: Ask the user to click Reload once on the unpacked extension**

The browser blocks automation of `edge://extensions`; instruct the user to open that page and click “重新加载” on Candidate Store. Do not ask the user to remove and reinstall it, because removal would discard extension-local pairing state.

- [ ] **Step 5: Verify the live symptom after reload**

On the currently open Liepin list page, verify that the side-panel switch removes and restores the buttons. Click one user-approved test card and confirm the button reaches `已加入` instead of `暂时无法识别`; do not capture any additional cards. On Maimai, verify only switch removal/restoration unless the user separately asks for a capture test.

- [ ] **Step 6: Record fresh verification evidence**

Run: `git status --short && git diff --check`

Expected: no whitespace errors; report the exact test count, build result, copied install locations, and the one remaining manual reload/live-check step if the user has not completed it.
