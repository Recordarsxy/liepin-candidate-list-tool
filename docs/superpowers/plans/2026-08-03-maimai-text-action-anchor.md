# Maimai Text Action Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover real Maimai candidate rows when the communication control is built from ordinary nested elements and is labelled either `立即沟通` or `沟通`, then keep the batch button immediately before the outer communication control.

**Architecture:** Replace tag-based action discovery in `maimai/card-parser.ts` with a visible-text-node walker. The walker expands a matching text node to the outermost ancestor whose visible text is still exactly the same communication label; existing row validation, parsing, placement, queue, and clipboard behavior then reuse that anchor.

**Tech Stack:** Chrome MV3, TypeScript 5.8, DOM `TreeWalker`, Vitest 3 with jsdom, Vite/esbuild, PowerShell installation verification.

## Global Constraints

- Accept only visible exact labels `立即沟通` and `沟通`; partial text matches are not action anchors.
- Do not require the action control to be `button`, `a`, or `[role=button]`.
- Expand to the outermost continuous ancestor whose visible text is exactly the same label. Allow textless decorative siblings inside the control, but stop before an ancestor containing a separate visible interactive sibling such as a phone or menu control. At the first non-exact ancestor, accept the current action only when that ancestor has a reliable display name before its profile/timeline boundary and at least one visible candidate evidence item: age, expectation, or a work/education timeline period. Otherwise reject the partial anchor. Insert `加入批量` before that outer communication control, never inside it or before the whole action group.
- Hidden text nodes and controls must not create cards or buttons.
- Keep visible-only field parsing, fixed 11-column TSV order, Liepin behavior, queue behavior, and clipboard behavior unchanged. Age and expectation are independently optional and produce empty output cells when absent.
- Do not automate Maimai acceptance; the user performs the final authenticated-page check manually.

---

### Task 1: Replace tag-based Maimai action discovery

**Files:**
- Modify: `tests/fixtures/maimai/list-normal.html`
- Modify: `extension/src/maimai/card-parser.test.ts`
- Modify: `extension/src/content/maimai.test.ts`
- Modify: `extension/src/maimai/card-parser.ts`

**Interfaces:**
- Consumes: existing `isVisible`, `visibleLeafTexts`, semantic row validation, `findMaimaiCards`, `findMaimaiCommunicationAction`, and Maimai content placement callback.
- Produces: unchanged public signatures `findMaimaiCards(root: ParentNode): HTMLElement[]` and `findMaimaiCommunicationAction(card: HTMLElement): HTMLElement | null`, backed by visible text anchors for both labels.

- [ ] **Step 1: Change the anonymous fixture to real-page-shaped nested controls**

Replace each plain action button with an action group whose communication control is an ordinary nested element. Use both labels:

```html
<div class="ActionGroup_alpha">
  <div class="CommunicationControl_alpha"><span>立即沟通</span><svg aria-hidden="true"></svg></div>
  <div class="PhoneControl_alpha" role="button" aria-label="phone"></div>
</div>

<div class="ActionGroup_beta">
  <div class="CommunicationControl_beta"><span>沟通</span><span class="DecorativeBadge_beta"></span></div>
  <div class="PhoneControl_beta" role="button" aria-label="phone"></div>
</div>
```

Keep all candidate values fictional and keep the existing age, expectation, work, and education tokens.

- [ ] **Step 2: Write failing parser tests**

Update the discovery test to assert two cards are returned and the action for each card is the outer `.CommunicationControl_*`, not its child `<span>`:

```ts
expect(findMaimaiCommunicationAction(cards[0])?.className).toBe(
  "CommunicationControl_alpha",
);
expect(findMaimaiCommunicationAction(cards[1])?.className).toBe(
  "CommunicationControl_beta",
);
```

Add a hidden nested-label test:

```ts
document.body.innerHTML = `
  <section>
    <strong>王先生</strong><span>29岁</span><span>期望：</span>
    <div style="display:none"><span>沟通</span></div>
  </section>`;
expect(findMaimaiCards(document)).toEqual([]);
```

- [ ] **Step 3: Write a failing content placement test**

Load the updated fixture and assert each injected batch button is the previous sibling of the outer communication control:

```ts
const actions = [
  document.querySelector<HTMLElement>(".CommunicationControl_alpha")!,
  document.querySelector<HTMLElement>(".CommunicationControl_beta")!,
];
for (const action of actions) {
  expect(action.previousElementSibling).toMatchObject({ textContent: "加入批量" });
  expect(action.querySelector("[data-candidate-collector-button]")).toBeNull();
}
```

Keep the assertions for one clipboard call, two rows, eleven cells per row, and `脉脉` in cell 11.

- [ ] **Step 4: Run focused tests and verify RED**

```powershell
cd extension
npm.cmd test -- --run src/maimai/card-parser.test.ts src/content/maimai.test.ts
```

Expected: discovery returns zero cards because the current implementation only scans `button,a,[role=button]` and only accepts `立即沟通`.

- [ ] **Step 5: Implement visible text-node action anchors**

Replace `ACTION_SELECTOR` and the single string constant with:

```ts
const COMMUNICATION_TEXTS = new Set(["立即沟通", "沟通"]);
```

Add a private helper that walks text nodes and expands each accepted label to its outer control:

```ts
function visibleCommunicationActions(root: ParentNode): HTMLElement[] {
  const document = root instanceof Document ? root : root.ownerDocument;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const actions: HTMLElement[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const label = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    if (!parent || !COMMUNICATION_TEXTS.has(label) || !isVisible(parent)) continue;
    let action = parent;
    while (
      action.parentElement &&
      action.parentElement !== root &&
      visibleTextFromNodes(action.parentElement) === label
    ) {
      action = action.parentElement;
    }
    if (!actions.includes(action)) actions.push(action);
  }
  return actions;
}
```

`visibleTextFromNodes(element)` must walk only visible descendant text nodes, normalize whitespace between their trimmed values, and return one string. Reuse `isVisible` so hidden descendants do not affect the exact-text expansion. Update `findMaimaiCards` and `findMaimaiCommunicationAction` to use `visibleCommunicationActions`; keep the existing single-action, age, and expectation checks unchanged.

Before expanding from `action` to `action.parentElement`, inspect the parent's other direct children. Ignore hidden children, `aria-hidden="true"` decoration, and textless non-interactive elements. Stop when another visible sibling is an independent control: `button`, `a`, `input`, `select`, `textarea`, `[role="button"]`, `[role="link"]`, a non-negative `[tabindex]`, or an element carrying a non-empty `aria-label`. This permits icons/badges inside the communication control while preventing expansion into the phone/menu action group.

Do not require the resolved action itself to satisfy `isIndependentControl`. At the first ancestor whose visible text differs from the label, compute that ancestor's visible leaf tokens. Accept it as the candidate-row boundary only when a reliable display name appears before the first profile/timeline boundary and at least one of these is visible: an age token accepted by `normalizeAge`, an expectation marker `/期望[：:]/`, or a timeline token accepted by `PERIOD`. Otherwise reject the anchor as a partial label inside an intermediate control. Reuse this candidate signature in `findMaimaiCards`.

Replace the age-dependent `findNameBeforeAge` with `findProfileName(tokens)`. Its boundary is the earliest age, experience token such as `12年`, education level (`大专/本科/硕士/博士`), expectation marker, or `PERIOD`. Before that boundary, choose the last short Chinese/masked-name token after excluding status text matching `活跃|求职|机会|动向|招聘动态|关注行情|简历`. For current location, prefer the first normalizable location after the visible education-level token and before expectation; otherwise scan after age while excluding experience, degree, name, and status tokens. Never use the name as a location.

Change the anonymous two-row fixture to represent the screenshot: row one has no age but has experience, degree, location, expectation, and history; row two has age, experience, degree, location, and history but no expectation. Add parser assertions that both rows are discovered, names are preserved, row one `age` is empty, row two `preferred_location` is empty, and both current locations normalize to city level. Keep the content test selecting/copying both rows.

- [ ] **Step 6: Run focused and full tests and verify GREEN**

```powershell
npm.cmd test -- --run src/maimai/card-parser.test.ts src/content/maimai.test.ts
npm.cmd test -- --run
npm.cmd run typecheck
```

Expected: focused tests pass; the full working-tree suite passes all 13 files and 69 or more tests; typecheck exits 0.

- [ ] **Step 7: Commit the parser fix**

```powershell
git add -- tests/fixtures/maimai/list-normal.html extension/src/maimai/card-parser.test.ts extension/src/content/maimai.test.ts extension/src/maimai/card-parser.ts
git commit -m "fix: find maimai controls by visible text"
```

---

### Task 2: Document, build, install, and hand off

**Files:**
- Modify: `README.md`
- Modify: `docs/install-windows.md`
- Generated but not committed: `extension/dist/**`
- Install copies: `C:\Users\shawnxu\AppData\Local\CandidateCollector\extension`, `C:\Users\shawnxu\Desktop\候选人采集插件`

**Interfaces:**
- Consumes: Task 1 text-node action discovery and unchanged Maimai placement callback.
- Produces: two installed directories containing the same six verified runtime files and instructions covering both communication labels.

- [ ] **Step 1: Update documentation**

Change Maimai button-placement wording from only “立即沟通” to “立即沟通”或“沟通”. State that the adapter accepts nested ordinary elements by visible text and still ignores hidden content.

- [ ] **Step 2: Commit documentation only**

```powershell
git add -- README.md docs/install-windows.md
git commit -m "docs: explain maimai communication labels"
```

- [ ] **Step 3: Run release verification**

```powershell
cd extension
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run build
cd ..
git diff --check
```

Expected: all tests pass, typecheck/build exit 0, and no whitespace errors are reported.

- [ ] **Step 4: Inspect the built Maimai bundle**

Verify `立即沟通`, `沟通`, `createTreeWalker`, `加入批量`, and `insertBefore` are present in `extension/dist/content/maimai.js`. Verify `2147483647` is absent from both content bundles.

- [ ] **Step 5: Install and verify exact files**

Overwrite only `manifest.json`, `sidepanel.html`, `dist/background.js`, `dist/content/liepin.js`, `dist/content/maimai.js`, and `dist/sidepanel/app.js` in both explicit target directories. Do not delete either directory. Compare every source/target SHA256 hash and require 6/6 matches per target.

- [ ] **Step 6: Manual acceptance handoff**

Ask the user to reload the unpacked extension, refresh Maimai manually, and confirm each visible row with either communication label has one `加入批量` immediately before the outer control. The user selects two rows and confirms a two-row by eleven-column paste. Do not connect browser automation.
