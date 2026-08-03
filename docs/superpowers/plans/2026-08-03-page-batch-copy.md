# Current-Page Batch Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select multiple Liepin or Maimai cards on the current page and copy them once as multiple 11-column TSV rows.

**Architecture:** A pure ordered batch-selection class owns candidate keys and formatted row text without touching the DOM or clipboard. The shared card-button controller owns button state and a fixed batch toolbar, calls the pure class, and writes the entire batch only when the user clicks `复制全部`. Both site content scripts keep their existing adapter injection and automatically receive the shared behavior.

**Tech Stack:** Chrome MV3, TypeScript 5.8, Vitest/jsdom, Vite/esbuild, PowerShell on Windows.

## Global Constraints

- The queue exists only in the current content-script instance; do not use `chrome.storage`, the background, a helper, or disk persistence.
- Each candidate is a headerless 11-column TSV row; batch rows are joined by exactly one `\n` with no trailing blank line.
- Preserve selection order and prevent duplicate queue keys.
- Use platform plus stable candidate ID as the key; without an ID, use the complete formatted row.
- Clipboard success clears the page queue immediately; clipboard failure preserves it.
- Refresh, navigation, tab close, collector disable, or disposer invocation clears the queue and removes the toolbar.
- Apply the same component to Liepin and Maimai.
- Shift card buttons left by 24px with `z-index: 1`; place the batch bar 24px from the right/bottom with `z-index: 900`, never `2147483647`.

---

### Task 1: Pure ordered batch selection

**Files:**
- Create: `extension/src/content/page-batch-selection.ts`
- Create: `extension/src/content/page-batch-selection.test.ts`

**Interfaces:**
- Consumes: `CandidateDraft` and `candidateToClipboardRow(draft)`.
- Produces: `PageBatchSelection.toggle(draft): boolean`, `has(draft): boolean`, `size: number`, `toClipboardText(): string`, and `clear(): void`.

- [ ] **Step 1: Write failing batch-selection tests**

```ts
import { describe, expect, it } from "vitest";
import type { CandidateDraft } from "../contracts/candidate";
import { PageBatchSelection } from "./page-batch-selection";

const makeDraft = (id: string | undefined, name: string): CandidateDraft => ({
  platform: "liepin",
  ...(id ? { platform_candidate_id: id } : {}),
  source_page_type: "list",
  current_company: "甲公司", name, gender: "", age: "",
  current_location: "", preferred_location: "", current_role: "销售",
  master_school: "", bachelor_school: "", bachelor_start_year: "",
});

describe("PageBatchSelection", () => {
  it("preserves selection order and joins rows with one newline", () => {
    const selection = new PageBatchSelection();
    const first = makeDraft("1", "张先生");
    const second = makeDraft("2", "李女士");
    expect(selection.toggle(first)).toBe(true);
    expect(selection.toggle(second)).toBe(true);
    expect(selection.size).toBe(2);
    expect(selection.toClipboardText().split("\n")).toHaveLength(2);
    expect(selection.toClipboardText()).not.toMatch(/\n$/);
  });

  it("toggles the same stable candidate off", () => {
    const selection = new PageBatchSelection();
    const draft = makeDraft("1", "张先生");
    selection.toggle(draft);
    expect(selection.has(draft)).toBe(true);
    expect(selection.toggle({ ...draft, name: "页面更新后的姓名" })).toBe(false);
    expect(selection.size).toBe(0);
  });

  it("uses the complete row as the fallback key and can clear", () => {
    const selection = new PageBatchSelection();
    const draft = makeDraft(undefined, "张先生");
    selection.toggle(draft);
    selection.toggle({ ...draft });
    expect(selection.size).toBe(0);
    selection.toggle(draft);
    selection.clear();
    expect(selection.toClipboardText()).toBe("");
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/content/page-batch-selection.test.ts`

Expected: FAIL because `page-batch-selection.ts` does not exist.

- [ ] **Step 3: Implement the minimal ordered selection**

```ts
import type { CandidateDraft } from "../contracts/candidate";
import { candidateToClipboardRow } from "../export/clipboard-row";

export class PageBatchSelection {
  private readonly rows = new Map<string, string>();

  get size(): number { return this.rows.size; }

  has(draft: CandidateDraft): boolean { return this.rows.has(keyFor(draft)); }

  toggle(draft: CandidateDraft): boolean {
    const key = keyFor(draft);
    if (this.rows.has(key)) { this.rows.delete(key); return false; }
    this.rows.set(key, candidateToClipboardRow(draft));
    return true;
  }

  toClipboardText(): string { return Array.from(this.rows.values()).join("\n"); }

  clear(): void { this.rows.clear(); }
}

function keyFor(draft: CandidateDraft): string {
  return draft.platform_candidate_id
    ? `${draft.platform}:${draft.platform_candidate_id}`
    : `row:${candidateToClipboardRow(draft)}`;
}
```

- [ ] **Step 4: Run the focused tests and verify green**

Run: `Set-Location extension; npm.cmd test -- --run src/content/page-batch-selection.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the pure selection**

```powershell
git add extension/src/content/page-batch-selection.ts extension/src/content/page-batch-selection.test.ts
git commit -m "feat: add current-page batch selection"
```

### Task 2: Batch card buttons and toolbar

**Files:**
- Modify: `extension/src/content/card-buttons.ts`
- Modify: `extension/src/content/card-buttons.test.ts`

**Interfaces:**
- Consumes: `PageBatchSelection` from Task 1 and existing `Options.copy(text)`.
- Produces: unchanged `installCardButtons(options): () => void` API with batch interaction.

- [ ] **Step 1: Replace single-copy tests with batch interaction tests**

Create two cards whose `parseCard` returns different IDs based on `card.dataset.card`. Assert:

```ts
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(
  "[data-candidate-collector-button]",
));
expect(buttons.map((button) => button.textContent)).toEqual(["加入批量", "加入批量"]);
buttons[0].click();
buttons[1].click();
expect(buttons.map((button) => button.textContent)).toEqual(["已选择", "已选择"]);
expect(document.querySelector("[data-candidate-collector-batch]")?.textContent)
  .toContain("已选 2 人");
expect(copy).not.toHaveBeenCalled();
document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")!.click();
await vi.waitFor(() => expect(copy).toHaveBeenCalledOnce());
expect(copy.mock.calls[0][0].split("\n")).toHaveLength(2);
await vi.waitFor(() => expect(buttons[0].textContent).toBe("加入批量"));
expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
```

Add tests that a second card click cancels it, manual `清空` resets all buttons, clipboard rejection keeps count/buttons and changes the copy action to `重试`, unparseable cards remain disabled, dynamic cards receive buttons, and disposer removes both buttons and toolbar.

Assert the card button uses `transform: translateX(-24px)`, `position: relative`, and `z-index: 1`, and does not contain `2147483647`.

- [ ] **Step 2: Run the focused UI tests and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/content/card-buttons.test.ts`

Expected: FAIL because current clicks write a single row immediately and no batch toolbar exists.

- [ ] **Step 3: Implement selection toggling in the shared controller**

Instantiate one `PageBatchSelection` per `installCardButtons` call. On a parseable card click, call `selection.toggle(draft)`, set the card button to `已选择` or `加入批量`, track selected state with `data-candidate-collector-selected="true"`, clear its error state, and render the toolbar from the current size. Do not call `options.copy` from card buttons.

Keep the existing `MutationObserver`, card guard, `preventDefault`, `stopPropagation`, and unparseable behavior.

- [ ] **Step 4: Implement the fixed batch toolbar**

Create a single element with `data-candidate-collector-batch="true"` and fixed bottom-right styling. It contains a count, a `data-action="copy-batch"` button, and a `data-action="clear-batch"` button.

Use `right: 24px`, `bottom: 24px`, and `z-index: 900` so the bar sits inside the viewport and below normal site dialogs.

The copy handler must capture the non-empty batch text, disable the copy action, and then:

```ts
void options.copy(selection.toClipboardText())
  .then(() => clearSelection())
  .catch((error: unknown) => {
    copyButton.textContent = "重试";
    copyButton.title = error instanceof Error ? error.message : "无法写入剪贴板";
    copyButton.disabled = false;
  });
```

`clearSelection()` clears the queue, resets only buttons carrying `data-candidate-collector-selected="true"` to `加入批量`, clears those buttons' selected attribute/title/disabled state, and removes the toolbar. Buttons already marked `暂时无法识别` stay disabled. The disposer calls the same cleanup before removing injected buttons.

- [ ] **Step 5: Run focused UI tests and regressions**

Run: `Set-Location extension; npm.cmd test -- --run src/content/card-buttons.test.ts src/content/collector-toggle.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit the batch UI**

```powershell
git add extension/src/content/card-buttons.ts extension/src/content/card-buttons.test.ts
git commit -m "feat: add batch copy toolbar"
```

### Task 3: Verify both content scripts use multi-row copying

**Files:**
- Modify: `extension/src/content/liepin.test.ts`
- Modify: `extension/src/content/maimai.test.ts`
- Modify: `README.md`
- Modify: `docs/install-windows.md`

**Interfaces:**
- Consumes: unchanged site installers and shared batch behavior from Task 2.
- Produces: automated two-row acceptance for both platform entry points and updated user instructions.

- [ ] **Step 1: Add two-card content regression tests**

Give each content-script test two valid cards with distinct candidate IDs. Click both card buttons, assert `writeText` has not run, click `[data-action='copy-batch']`, then assert one clipboard call whose text has two lines and every line has 11 Tab-separated cells. Assert each line's last cell is `猎聘` or `脉脉` respectively.

- [ ] **Step 2: Run the two content tests**

Run: `Set-Location extension; npm.cmd test -- --run src/content/liepin.test.ts src/content/maimai.test.ts`

Expected: PASS after Task 2 because both entries share `installCardButtons`; if a site harness exposes only one valid card, fix the anonymous fixture until the test exercises two cards.

- [ ] **Step 3: Update user instructions**

Replace the single-card workflow in `README.md` and `docs/install-windows.md` with:

1. Click `加入批量` on each desired card.
2. Confirm the page batch bar count.
3. Click `复制全部`; successful copy clears the page selection.
4. Paste into the first DingTalk cell to fill multiple rows and 11 columns.
5. Use `清空` before copying to cancel the current batch.

State that the queue is page-only and that Maimai is enabled but requires live DOM verification on the user's current page.

- [ ] **Step 4: Run full verification**

Run: `Set-Location extension; npm.cmd test -- --run`

Expected: all tests PASS with zero failures.

Run: `Set-Location extension; npm.cmd run typecheck`

Expected: exit code 0.

Run: `Set-Location extension; npm.cmd run build`

Expected: all four bundles build successfully.

- [ ] **Step 5: Commit platform tests and docs**

```powershell
git add extension/src/content/liepin.test.ts extension/src/content/maimai.test.ts README.md docs/install-windows.md
git commit -m "docs: explain current-page batch copying"
```

### Task 4: Install and live handoff

**Files:**
- Installed copy: `C:\Users\shawnxu\AppData\Local\CandidateCollector\extension`
- Installed copy: `C:\Users\shawnxu\Desktop\候选人采集插件`

**Interfaces:**
- Consumes: verified extension build.
- Produces: both existing installation directories updated in place.

- [ ] **Step 1: Copy the verified runtime files**

Resolve the source and exact targets. Copy only `manifest.json`, `sidepanel.html`, and all files under `dist`, creating missing subdirectories and deleting nothing.

- [ ] **Step 2: Verify installed SHA256 hashes**

Compare every copied file between source and both targets using `Get-FileHash -Algorithm SHA256`.

Expected: every corresponding hash matches.

- [ ] **Step 3: Ask the user to reload and verify Liepin**

After reload, select at least two Liepin cards, click `复制全部`, and validate clipboard structure without printing candidate values: two or more lines, 11 cells per line, correct normalized gender/name/age/location fields, and source `猎聘`.

- [ ] **Step 4: Verify Maimai when the user opens its candidate page**

Confirm the page shows one `加入批量` button per actual candidate card. Select at least one card and validate one 11-cell row with source `脉脉`. If buttons are missing or cards are overmatched, capture only anonymous selector structure and start a separate parser-fix cycle.

- [ ] **Step 5: Record repository state**

Run: `git status --short` and `git log -8 --oneline`.

Expected: new feature commits are present and unrelated pre-existing dirty files remain untouched.
