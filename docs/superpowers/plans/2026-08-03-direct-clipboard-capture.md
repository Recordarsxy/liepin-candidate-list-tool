# Direct Clipboard Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local-helper candidate workflow with one-click copying of the clicked Liepin or Maimai card as one headerless 11-column TSV row.

**Architecture:** Existing site adapters continue to return `CandidateDraft`. A pure formatter converts that draft into a sanitized 11-column row, and the generic card-button controller writes it through an injected clipboard function. The background only opens the side panel; the side panel only controls whether buttons are enabled and explains the paste workflow.

**Tech Stack:** Chrome MV3, TypeScript 5.8, Vitest/jsdom, Vite/esbuild, PowerShell on Windows.

## Global Constraints

- Clipboard output is a single row with no header and exactly 11 columns in this order: `目前公司｜姓名｜性别｜年龄｜目前地点｜期望地点｜目前岗位｜硕士学校｜本科学校｜本科入学时间｜渠道来源`.
- Missing values remain empty; values are never inferred from unrelated visible text.
- Tabs, carriage returns, and line feeds inside values become spaces; the row always contains exactly 10 delimiter tabs.
- Source is exactly `猎聘` for `liepin` and `脉脉` for `maimai`.
- Only the card explicitly clicked by the user is parsed; no detail page, automatic paging, contacts, cookies, or network responses are collected.
- Keep the persistent `采集已开启/采集已关闭` side-panel toggle.
- Add only `clipboardWrite`; remove the localhost host permission and never add `cookies`, `webRequest`, or `webRequestBlocking`.
- Do not delete the installed helper or its historical files; stop using it and stop its running process after installation.

---

### Task 1: Pure 11-column clipboard formatter

**Files:**
- Create: `extension/src/export/clipboard-row.ts`
- Create: `extension/src/export/clipboard-row.test.ts`

**Interfaces:**
- Consumes: `CandidateDraft` from `extension/src/contracts/candidate.ts`.
- Produces: `candidateToClipboardRow(draft: CandidateDraft): string`.

- [ ] **Step 1: Write the failing formatter tests**

```ts
import { describe, expect, it } from "vitest";
import type { CandidateDraft } from "../contracts/candidate";
import { candidateToClipboardRow } from "./clipboard-row";

const base: CandidateDraft = {
  platform: "liepin",
  source_page_type: "list",
  current_company: "甲\t公司",
  name: "陈女士\n",
  gender: "女",
  age: "31岁",
  current_location: "上海",
  preferred_location: "杭州\r\n上海",
  current_role: "机构销售",
  master_school: "复旦大学",
  bachelor_school: "浙江大学",
  bachelor_start_year: "2013",
};

describe("candidateToClipboardRow", () => {
  it("emits sanitized fields in the fixed DingTalk order", () => {
    const row = candidateToClipboardRow(base);
    expect(row.split("\t")).toEqual([
      "甲 公司", "陈女士", "女", "31岁", "上海", "杭州 上海",
      "机构销售", "复旦大学", "浙江大学", "2013", "猎聘",
    ]);
    expect(row.match(/\t/g)).toHaveLength(10);
  });

  it("preserves empty cells and maps the Maimai source", () => {
    const row = candidateToClipboardRow({
      ...base,
      platform: "maimai",
      gender: "",
      master_school: "",
      bachelor_start_year: "",
    });
    expect(row.split("\t")).toEqual([
      "甲 公司", "陈女士", "", "31岁", "上海", "杭州 上海",
      "机构销售", "", "浙江大学", "", "脉脉",
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/export/clipboard-row.test.ts`

Expected: FAIL because `./clipboard-row` does not exist.

- [ ] **Step 3: Implement the pure formatter**

```ts
import type { CandidateDraft } from "../contracts/candidate";

function sanitize(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

export function candidateToClipboardRow(draft: CandidateDraft): string {
  return [
    draft.current_company,
    draft.name,
    draft.gender,
    draft.age,
    draft.current_location,
    draft.preferred_location,
    draft.current_role,
    draft.master_school,
    draft.bachelor_school,
    draft.bachelor_start_year,
    draft.platform === "liepin" ? "猎聘" : "脉脉",
  ].map(sanitize).join("\t");
}
```

- [ ] **Step 4: Run the focused test and verify green**

Run: `Set-Location extension; npm.cmd test -- --run src/export/clipboard-row.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the formatter**

```powershell
git add extension/src/export/clipboard-row.ts extension/src/export/clipboard-row.test.ts
git commit -m "feat: format candidates for clipboard paste"
```

### Task 2: Copy-oriented card button behavior

**Files:**
- Modify: `extension/src/content/card-buttons.ts`
- Modify: `extension/src/content/card-buttons.test.ts`

**Interfaces:**
- Consumes: `candidateToClipboardRow(draft)` from Task 1.
- Produces: `installCardButtons({ root, findCards, parseCard, copy }): () => void`, where `copy(text: string): Promise<void>`.

- [ ] **Step 1: Replace capture assertions with clipboard-state tests**

Update the test options from `capture` to `copy`. Assert the initial label is `复制候选人`, the copied argument is `candidateToClipboardRow(draft)`, the success label is `已复制`, and the button is enabled after success. Click a second time and assert `copy` has been called twice. Keep the unparseable and disposer tests, changing the spy name to `copy`. Change the failure test to reject with `new Error("剪贴板被浏览器拒绝")` and assert `重试`, the exact title, and `disabled === false`. Add a dynamic-card test that appends a second `[data-card]` element and waits until two buttons exist.

```ts
const copy = vi.fn().mockResolvedValue(undefined);
const dispose = installCardButtons({ root: document, findCards, parseCard: () => draft, copy });
const button = document.querySelector<HTMLButtonElement>("button")!;
expect(button.textContent).toBe("复制候选人");
button.click();
await vi.waitFor(() => expect(button.textContent).toBe("已复制"));
expect(copy).toHaveBeenCalledWith(candidateToClipboardRow(draft));
expect(button.disabled).toBe(false);
button.click();
await vi.waitFor(() => expect(copy).toHaveBeenCalledTimes(2));
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/content/card-buttons.test.ts`

Expected: FAIL because `installCardButtons` still accepts `capture` and renders the old labels.

- [ ] **Step 3: Implement the copy state machine**

Change `Options.capture` to `Options.copy`, import `candidateToClipboardRow`, set the initial label to `复制候选人`, and replace the operation body with:

```ts
button.textContent = "复制中…";
button.title = "";
button.disabled = true;
try {
  await options.copy(candidateToClipboardRow(draft));
  button.textContent = "已复制";
  button.disabled = false;
} catch (error: unknown) {
  button.textContent = "重试";
  button.title = error instanceof Error ? error.message : "无法写入剪贴板";
  button.disabled = false;
}
```

Leave the `MutationObserver`, duplicate-button guard, unparseable-card guard, event cancellation, and disposer intact.

- [ ] **Step 4: Run the focused test and verify green**

Run: `Set-Location extension; npm.cmd test -- --run src/content/card-buttons.test.ts`

Expected: all card-button tests PASS.

- [ ] **Step 5: Commit button behavior**

```powershell
git add extension/src/content/card-buttons.ts extension/src/content/card-buttons.test.ts
git commit -m "feat: copy clicked candidate cards"
```

### Task 3: Wire both site scripts directly to the clipboard

**Files:**
- Modify: `extension/src/content/liepin.ts`
- Modify: `extension/src/content/liepin.test.ts`
- Modify: `extension/src/content/maimai.ts`
- Create: `extension/src/content/maimai.test.ts`

**Interfaces:**
- Consumes: `installCardButtons(..., copy)` from Task 2 and unchanged site parsers.
- Produces: `installLiepinCardButtons(root, writeText)` and `installMaimaiCardButtons(root, writeText)`, where `writeText(text: string): Promise<void>`.

- [ ] **Step 1: Write direct-copy tests for both sites**

For Liepin, replace the runtime-message spy with `writeText`, click the card button, and assert the argument splits into 11 expected cells with source `猎聘`. Replace the helper-error test with a rejected clipboard write and assert `重试`. Keep the page-context import check and add assertions that the source contains neither `sendMessage` nor `CAPTURE_MESSAGE`.

For Maimai, add this focused test using the parser's supported data attributes:

```ts
document.body.innerHTML = `
  <article data-maimai-candidate-id="mm-1">
    <span data-field="name">王先生</span>
    <span data-field="current-company">乙公司</span>
    <span data-field="current-role">销售总监</span>
  </article>`;
const writeText = vi.fn().mockResolvedValue(undefined);
const dispose = installMaimaiCardButtons(document, writeText);
document.querySelector<HTMLButtonElement>("button")!.click();
await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
const cells = writeText.mock.calls[0][0].split("\t");
expect(cells).toHaveLength(11);
expect(cells[1]).toBe("王先生");
expect(cells[10]).toBe("脉脉");
dispose();
```

- [ ] **Step 2: Run the two content-script tests and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/content/liepin.test.ts src/content/maimai.test.ts`

Expected: FAIL because the installers still send runtime messages.

- [ ] **Step 3: Replace runtime messaging with clipboard injection**

In each content script, remove `CAPTURE_MESSAGE`, `requireRuntimeStatus`, and `chrome.runtime`. Define:

```ts
type WriteText = (text: string) => Promise<void>;

export function installLiepinCardButtons(root: Document, writeText: WriteText): () => void {
  return installCardButtons({
    root,
    findCards: findLiepinCards,
    parseCard: parseLiepinCard,
    copy: writeText,
  });
}
```

Use the analogous Maimai names. In each browser bootstrap, pass `navigator.clipboard.writeText.bind(navigator.clipboard)` through the existing collector toggle. Keep only `chrome.storage.local` and `chrome.storage.onChanged` in the local declaration.

- [ ] **Step 4: Run site and parser regressions**

Run: `Set-Location extension; npm.cmd test -- --run src/content/liepin.test.ts src/content/maimai.test.ts src/liepin/card-parser.test.ts src/maimai/card-parser.test.ts src/content/collector-toggle.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit direct site wiring**

```powershell
git add extension/src/content/liepin.ts extension/src/content/liepin.test.ts extension/src/content/maimai.ts extension/src/content/maimai.test.ts
git commit -m "feat: wire site cards to the clipboard"
```

### Task 4: Remove helper UI and permissions from the extension runtime

**Files:**
- Modify: `extension/src/background.ts`
- Modify: `extension/src/background.test.ts`
- Modify: `extension/src/sidepanel/app.ts`
- Modify: `extension/src/sidepanel/app.test.ts`
- Modify: `extension/sidepanel.html`
- Modify: `extension/manifest.json`

**Interfaces:**
- Produces: `registerSidePanelAction(action, sidePanel): void` and `mountSidePanel(root, { storage }): Promise<void>`.
- Preserves: `COLLECTOR_ENABLED_KEY = "collectorEnabled"` and the existing storage behavior.

- [ ] **Step 1: Write failing background, panel, and permission tests**

Replace helper-client tests with a harness that captures the action listener, calls it with `{ windowId: 42 }`, and expects `sidePanel.open({ windowId: 42 })`. Assert a tab without a numeric window ID does nothing.

Replace side-panel pool tests with assertions that the first section contains the toggle, the text contains `点击猎聘或脉脉卡片上的“复制候选人”`, toggling persists `collectorEnabled: false`, and the DOM contains none of `[data-action='pair']`, `[data-action='sync-selected']`, or `[data-candidate-field]`.

Parse `manifest.json` and assert:

```ts
expect(manifest.permissions).toEqual(expect.arrayContaining(["sidePanel", "storage", "clipboardWrite"]));
expect(manifest.host_permissions ?? []).not.toContain("http://127.0.0.1:8765/*");
expect(manifest.permissions).not.toEqual(expect.arrayContaining(["cookies", "webRequest", "webRequestBlocking"]));
```

- [ ] **Step 2: Run focused runtime tests and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/background.test.ts src/sidepanel/app.test.ts`

Expected: FAIL because helper messaging, pairing, and candidate-pool UI still exist.

- [ ] **Step 3: Reduce the background to opening the side panel**

Implement and bootstrap only:

```ts
type Action = { onClicked: { addListener(listener: (tab: { windowId?: number }) => void): void } };
type SidePanel = { open(options: { windowId: number }): Promise<void> };

export function registerSidePanelAction(action: Action, sidePanel: SidePanel): void {
  action.onClicked.addListener((tab) => {
    if (typeof tab.windowId === "number") void sidePanel.open({ windowId: tab.windowId });
  });
}
```

Remove helper URLs, candidate message handling, pairing, fetch, and token storage from `background.ts`.

- [ ] **Step 4: Reduce the side panel to the toggle and instructions**

Keep `renderCollectorToggle`, change `mountSidePanel` dependencies to `{ storage }`, and render a heading plus:

```ts
instructions.textContent =
  "点击猎聘或脉脉卡片上的“复制候选人”，再到钉钉表格第一列粘贴。缺失字段会保持空白。";
root.replaceChildren(toggle, heading, instructions);
```

Remove pairing, candidate review, merge, delete, sync, DingTalk configuration, `fetchImpl`, and `runtime.sendMessage` from the built side-panel entry. Change the HTML title to `候选人复制工具` and simplify styles to the toggle/instruction layout.

- [ ] **Step 5: Apply the minimal manifest permission set**

Set the description and action title to the clipboard workflow, set permissions to `['sidePanel', 'storage', 'clipboardWrite']`, and remove `host_permissions` entirely. Keep both existing recruitment-site content-script matches.

- [ ] **Step 6: Run focused runtime tests and typecheck**

Run: `Set-Location extension; npm.cmd test -- --run src/background.test.ts src/sidepanel/app.test.ts src/content/liepin.test.ts src/content/maimai.test.ts`

Expected: all selected tests PASS.

Run: `Set-Location extension; npm.cmd run typecheck`

Expected: exit code 0.

- [ ] **Step 7: Commit the runtime simplification**

```powershell
git add extension/src/background.ts extension/src/background.test.ts extension/src/sidepanel/app.ts extension/src/sidepanel/app.test.ts extension/sidepanel.html extension/manifest.json
git commit -m "refactor: remove helper from extension runtime"
```

### Task 5: Align verification and user documentation

**Files:**
- Modify: `scripts/verify-release.ps1`
- Modify: `README.md`
- Modify: `docs/install-windows.md`

**Interfaces:**
- Produces: an extension-only release check and installation instructions that contain no pairing or DingTalk API setup.

- [ ] **Step 1: Add release-script assertions before removing helper work**

After parsing `manifest.json`, require `clipboardWrite` and reject any localhost host permission:

```powershell
if ($Manifest.permissions -notcontains "clipboardWrite") {
    throw "Required extension permission missing: clipboardWrite"
}
if ($Manifest.host_permissions -contains "http://127.0.0.1:8765/*") {
    throw "Local helper host permission must not be present"
}
```

Then remove Python tests, helper packaging, helper health smoke testing, and runtime-directory cleanup from this release script. Keep extension tests, build, forbidden-permission checks, and Git sensitive-file checks.

- [ ] **Step 2: Rewrite the user-facing workflow**

Update `README.md` and `docs/install-windows.md` to describe:

1. Run `npm.cmd ci` and `npm.cmd run build` in `extension`.
2. Load or reload the existing unpacked extension directory.
3. Open the extension side panel to enable/disable buttons.
4. Click `复制候选人` on one visible summary card.
5. Paste into the first cell of a DingTalk row to populate 11 columns.
6. If `暂时无法识别` appears, the site adapter needs updating; the clipboard is not changed.

Explicitly state that the helper, pairing code, and DingTalk credentials are no longer required and that the old helper files may remain installed but unused.

- [ ] **Step 3: Run the extension-only release verification**

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`

Expected: extension tests, typecheck, build, permission checks, and sensitive-file checks pass; no helper executable is built or launched.

- [ ] **Step 4: Commit docs and verification**

```powershell
git add scripts/verify-release.ps1 README.md docs/install-windows.md
git commit -m "docs: switch installation to clipboard workflow"
```

### Task 6: Full verification, installation, and live handoff

**Files:**
- Build output: `extension/dist/background.js`
- Build output: `extension/dist/content/liepin.js`
- Build output: `extension/dist/content/maimai.js`
- Build output: `extension/dist/sidepanel/app.js`
- Installed copy: `C:\Users\shawnxu\AppData\Local\CandidateCollector\extension`
- Installed copy: `C:\Users\shawnxu\Desktop\候选人采集插件`

**Interfaces:**
- Consumes: the complete extension-only implementation.
- Produces: both existing unpacked-extension directories updated in place, with the old helper process stopped but files preserved.

- [ ] **Step 1: Run fresh full verification**

Run: `Set-Location extension; npm.cmd test -- --run`

Expected: all extension tests PASS.

Run: `Set-Location extension; npm.cmd run typecheck`

Expected: exit code 0.

Run: `Set-Location extension; npm.cmd run build`

Expected: all four bundles build successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Inspect the final built surface**

Search the manifest and built bundles for forbidden runtime dependencies:

```powershell
rg -n "127\.0\.0\.1|pairingToken|CAPTURE_MESSAGE|加入待办|写入钉钉" extension/manifest.json extension/dist
```

Expected: no matches.

- [ ] **Step 3: Validate and update both installed extension directories**

Resolve the repository extension path and the two exact target paths. Confirm each target is either the existing CandidateCollector extension directory or the existing desktop copy, then copy `manifest.json`, `sidepanel.html`, and `dist` into each target with PowerShell `Copy-Item -LiteralPath ... -Recurse -Force`. Do not use a mirror or deletion option, so unrelated historical files are not removed.

- [ ] **Step 4: Verify installed file hashes**

For `manifest.json`, `sidepanel.html`, and every file under `dist`, compare `Get-FileHash -Algorithm SHA256` between the build directory and both installed copies.

Expected: every corresponding hash matches.

- [ ] **Step 5: Stop only the obsolete installed helper process**

Find `candidate-collector` processes whose resolved executable path begins with `C:\Users\shawnxu\AppData\Local\CandidateCollector\helper\`. Stop only those process IDs. Do not delete the executable, database, logs, credentials, or any CandidateCollector directory.

- [ ] **Step 6: Ask the user to reload the extension**

Tell the user to open the browser extension management page and click the existing extension's reload button. This internal browser page requires manual interaction.

- [ ] **Step 7: Complete live acceptance after reload**

On one Liepin card and one Maimai card, click `复制候选人` and confirm the button becomes `已复制`. Read the clipboard only to validate structural properties without printing candidate values: the text is one line, `split("\t").length === 11`, and the final source cell is the correct platform. Paste into a non-production test row only if the user provides or selects one; otherwise hand off manual paste verification.

- [ ] **Step 8: Record final repository state**

Run: `git status --short` and `git log -6 --oneline`.

Expected: implementation commits are present; any pre-existing unrelated dirty files remain untouched and are reported separately.
