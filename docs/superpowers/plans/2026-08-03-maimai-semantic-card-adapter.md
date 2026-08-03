# Maimai Semantic Card Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the installed extension discover real Maimai recruiter result rows from their visible semantics, parse the fixed eleven candidate fields, and place each batch button immediately before the row's “立即沟通” button.

**Architecture:** `maimai/card-parser.ts` owns Maimai-only semantic discovery and visible-text parsing. The shared card-button controller gains one optional placement callback while preserving its default Liepin placement. The Maimai content script supplies that callback, so the existing page queue and clipboard exporter remain unchanged.

**Tech Stack:** Chrome MV3, TypeScript 5.8, Vitest 3 with jsdom, Vite/esbuild, PowerShell installation scripts.

## Global Constraints

- Read only the current visible candidate row; do not open details, inspect responses, read Cookie data, or collect contact information.
- Keep the output order exactly `目前公司｜姓名｜性别｜年龄｜目前地点｜期望地点｜目前岗位｜硕士学校｜本科学校｜本科入学时间｜渠道来源`.
- Missing or ambiguous fields are empty strings; no school, role, gender, or location inference beyond the approved normalization rules.
- Keep Liepin selectors, parsing, queue behavior, and clipboard format unchanged.
- Do not automate or take control of the Maimai page during final acceptance because that triggers its login protection.

---

### Task 1: Discover and parse semantic Maimai rows

**Files:**
- Modify: `tests/fixtures/maimai/list-normal.html`
- Modify: `extension/src/maimai/card-parser.test.ts`
- Modify: `extension/src/shared/candidate-normalization.test.ts`
- Modify: `extension/src/shared/candidate-normalization.ts`
- Modify: `extension/src/maimai/card-parser.ts`

**Interfaces:**
- Consumes: `CandidateDraft`, `normalizeAge`, `normalizeCityLevelLocation`, and `normalizeMaskedName`.
- Produces: `findMaimaiCards(root: ParentNode): HTMLElement[]`, `findMaimaiCommunicationAction(card: HTMLElement): HTMLElement | null`, and `parseMaimaiCard(card: HTMLElement): CandidateDraft | null`.

- [ ] **Step 1: Replace the old synthetic fixture with anonymous screenshot-shaped rows**

Use two rows with arbitrary hashed class names and no `data-field`, `candidate-card`, or `resume-card` selectors. Each row must have an exact `<button>立即沟通</button>`, a summary such as `29岁 / 7年 / 本科 / 北京海淀区`, a `期望：北京` block, work history, and explicit education history. Use fictional values only:

```html
<main class="TalentSearch_result__fixture">
  <section class="TalentRow_alpha">
    <div class="Profile_alpha">
      <svg aria-hidden="true"><path fill="#085DFF"></path></svg>
      <strong>陈**</strong><span>近1周活跃</span>
      <div><span>29岁</span><span>7年</span><span>本科</span><span>北京海淀区</span></div>
      <div><span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span></div>
    </div>
    <div class="Timeline_alpha">
      <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
      <div><span>2018.09 - 2021.06</span><span>示例大学</span><span>电子信息</span><span>硕士</span></div>
      <div><span>2014.09 - 2018.06</span><span>示例学院</span><span>自动化</span><span>本科</span></div>
    </div>
    <div class="Actions_alpha"><button type="button">立即沟通</button></div>
  </section>
  <section class="TalentRow_beta">
    <div><strong>周女士</strong><span>34岁</span><span>11年</span><span>硕士</span><span>陕西西安</span></div>
    <div><span>期望：</span><span>西安</span><span>15k-30k</span><span>行业分析师</span></div>
    <div><span>2021.06 - 2024.05</span><span>匿名研究院</span><span>行业研究员</span></div>
    <div><span>2017.09 - 2020.06</span><span>匿名大学</span><span>金融</span><span>硕士</span></div>
    <div><button type="button">立即沟通</button></div>
  </section>
</main>
```

- [ ] **Step 2: Write failing discovery, parsing, and location tests**

Add assertions that the semantic finder returns two rows in document order, finds each row's action anchor, and parses the first row to:

```ts
expect(parseMaimaiCard(cards[0])).toEqual({
  platform: "maimai",
  source_page_type: "list",
  current_company: "示例科技",
  name: "陈先生",
  gender: "男",
  age: "29",
  current_location: "北京",
  preferred_location: "北京",
  current_role: "行业顾问",
  master_school: "示例大学",
  bachelor_school: "示例学院",
  bachelor_start_year: "2014",
});
```

Assert the second row has empty bachelor fields and these city normalizations:

```ts
expect(normalizeCityLevelLocation("北京海淀区")).toBe("北京");
expect(normalizeCityLevelLocation("陕西西安")).toBe("西安");
expect(normalizeCityLevelLocation("福建福州")).toBe("福州");
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
cd extension
npm.cmd test -- --run src/maimai/card-parser.test.ts src/shared/candidate-normalization.test.ts
```

Expected: failures show zero semantic cards and unnormalized concatenated city/district values.

- [ ] **Step 4: Implement the minimal semantic parser**

In `candidate-normalization.ts`, preserve delimiter behavior, then return a municipality prefix, a `...市` name without its suffix, or the value after a known province prefix. Reject standalone district/county/province values.

In `maimai/card-parser.ts`, implement these helpers:

```ts
const ACTION_SELECTOR = "button,a,[role='button']";
const PERIOD = /(?:19|20)\d{2}[./-]\d{1,2}\s*[-–—]\s*(?:至今|(?:19|20)\d{2}[./-]\d{1,2})/;

export function findMaimaiCommunicationAction(card: HTMLElement): HTMLElement | null {
  return visibleActions(card).find((element) => visibleText(element) === "立即沟通") ?? null;
}

export function findMaimaiCards(root: ParentNode): HTMLElement[] {
  const cards: HTMLElement[] = [];
  for (const action of visibleActions(root).filter(
    (element) => visibleText(element) === "立即沟通",
  )) {
    let candidate = action.parentElement;
    while (candidate && candidate !== root) {
      const text = visibleText(candidate);
      const actionCount = visibleActions(candidate).filter(
        (element) => visibleText(element) === "立即沟通",
      ).length;
      if (actionCount === 1 && /\d{1,3}\s*岁/.test(text) && /期望[：:]/.test(text)) {
        if (!cards.includes(candidate)) cards.push(candidate);
        break;
      }
      candidate = candidate.parentElement;
    }
  }
  return cards;
}
```

Collect visible leaf text in DOM order. Choose the last short Chinese name token before the age token while excluding activity/degree labels. Detect gender only from the exact SVG colors `#FF5833` and `#085DFF`. Parse the summary and expectation blocks from ordered tokens. Build minimal history rows containing one `PERIOD`; split their leaf tokens into period, company/school, role/major, and optional degree. The first non-education row is current work; explicit `硕士` and `本科` rows provide schools, and the本科 period provides the four-digit start year. Return `null` only when name is absent or both current company and current role are absent.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command. Expected: both files pass with no warnings.

- [ ] **Step 6: Commit semantic parsing**

```powershell
git add -- tests/fixtures/maimai/list-normal.html extension/src/maimai/card-parser.test.ts extension/src/shared/candidate-normalization.test.ts extension/src/shared/candidate-normalization.ts extension/src/maimai/card-parser.ts
git commit -m "feat: parse semantic maimai candidate rows"
```

---

### Task 2: Mount Maimai buttons before communication actions

**Files:**
- Modify: `extension/src/content/card-buttons.test.ts`
- Modify: `extension/src/content/card-buttons.ts`
- Modify: `extension/src/content/maimai.test.ts`
- Modify: `extension/src/content/maimai.ts`

**Interfaces:**
- Consumes: `findMaimaiCards`, `findMaimaiCommunicationAction`, and `parseMaimaiCard` from Task 1.
- Produces: optional `mountButton?: (card: HTMLElement, button: HTMLButtonElement) => void` in the shared button-controller options.

- [ ] **Step 1: Write a failing shared placement callback test**

Install the controller with a card containing an existing action button and this callback:

```ts
mountButton: (card, button) => {
  const action = card.querySelector<HTMLButtonElement>("[data-action-anchor]")!;
  action.parentElement!.insertBefore(button, action);
},
```

Assert `button.nextElementSibling` is the action anchor. Keep the existing default-style assertion `translateX(-24px)` to protect Liepin.

- [ ] **Step 2: Run the card-button test and verify RED**

```powershell
cd extension
npm.cmd test -- --run src/content/card-buttons.test.ts
```

Expected: TypeScript/Vitest reports that `mountButton` is not a valid option or the button remains appended after the action.

- [ ] **Step 3: Add the optional mount callback**

Extend `Options` and replace only the final append operation:

```ts
type Options = {
  root: Document;
  findCards: (root: ParentNode) => HTMLElement[];
  parseCard: (card: HTMLElement) => CandidateDraft | null;
  copy: (text: string) => Promise<void>;
  mountButton?: (card: HTMLElement, button: HTMLButtonElement) => void;
};

if (options.mountButton) options.mountButton(card, button);
else card.append(button);
```

- [ ] **Step 4: Run the shared test and verify GREEN**

Run the same command. Expected: all card-button tests pass, including default Liepin styling.

- [ ] **Step 5: Write a failing Maimai content integration test**

Load the anonymous fixture twice with distinct fictional content, install Maimai buttons, and assert:

```ts
const actions = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
  .filter((button) => button.textContent === "立即沟通");
expect(actions).toHaveLength(2);
for (const action of actions) {
  expect(action.previousElementSibling).toMatchObject({
    textContent: "加入批量",
  });
}
```

Then select both injected buttons, click `复制全部`, and assert one clipboard call contains two lines, eleven Tab-separated cells per line, and `脉脉` in cell 11.

- [ ] **Step 6: Run the Maimai integration test and verify RED**

```powershell
npm.cmd test -- --run src/content/maimai.test.ts
```

Expected: buttons are not located immediately before the action anchors.

- [ ] **Step 7: Supply Maimai-specific placement**

Pass this callback from `installMaimaiCardButtons`:

```ts
mountButton: (card, button) => {
  const action = findMaimaiCommunicationAction(card);
  if (!action?.parentElement) {
    card.append(button);
    return;
  }
  button.style.transform = "none";
  button.style.margin = "0 8px 0 0";
  action.parentElement.insertBefore(button, action);
},
```

- [ ] **Step 8: Run integration tests and verify GREEN**

```powershell
npm.cmd test -- --run src/content/card-buttons.test.ts src/content/maimai.test.ts
```

Expected: both files pass and no button is duplicated.

- [ ] **Step 9: Commit button placement**

```powershell
git add -- extension/src/content/card-buttons.test.ts extension/src/content/card-buttons.ts extension/src/content/maimai.test.ts extension/src/content/maimai.ts
git commit -m "feat: place maimai batch buttons by action anchor"
```

---

### Task 3: Regression verification, installation, and manual handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/install-windows.md`
- Generated but not committed: `extension/dist/**`
- Install copies: `C:\Users\shawnxu\AppData\Local\CandidateCollector\extension`, `C:\Users\shawnxu\Desktop\候选人采集插件`

**Interfaces:**
- Consumes: the semantic Maimai parser and shared placement hook from Tasks 1–2.
- Produces: two hash-identical installed extension directories ready for manual browser reload.

- [ ] **Step 1: Update operator documentation**

State that Maimai buttons appear immediately left of “立即沟通”, that the adapter uses only visible row semantics, and that Maimai acceptance must be manual because browser takeover triggers login protection.

- [ ] **Step 2: Run full verification**

```powershell
cd extension
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run build
cd ..
git diff --check
```

Expected: 13 test files plus the new assertions pass, typecheck/build exit 0, and `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Inspect built behavior**

```powershell
rg -n -F "立即沟通" extension/dist/content/maimai.js
rg -n -F "加入批量" extension/dist/content/maimai.js
rg -n -F "insertBefore" extension/dist/content/maimai.js
```

Expected: all three strings appear. Also verify `2147483647` is absent from both content bundles.

- [ ] **Step 4: Commit documentation**

```powershell
git add -- README.md docs/install-windows.md
git commit -m "docs: explain maimai semantic card support"
```

- [ ] **Step 5: Install without deleting user files**

Copy only `manifest.json`, `sidepanel.html`, `dist/background.js`, `dist/content/liepin.js`, `dist/content/maimai.js`, and `dist/sidepanel/app.js` to both installed directories. Create missing `dist` parents, overwrite only those six files, and compare every source/target SHA256 hash.

- [ ] **Step 6: Manual acceptance**

Ask the user to reload the unpacked extension and refresh Maimai manually. The user confirms that every visible candidate row has one “加入批量” immediately left of “立即沟通”, selects two test rows, clicks `复制全部`, and pastes into a blank area to confirm two rows by eleven columns. Do not connect browser automation during this acceptance.
