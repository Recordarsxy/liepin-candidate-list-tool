# Candidate Field Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy explicit Liepin gender, politely normalize one-surname masked names, remove the age suffix, and reduce current and expected locations to city level without changing the 11-column clipboard layout.

**Architecture:** Pure text normalizers live in one shared module and are used by the shared card parser as well as the live Liepin parser. Liepin SVG recognition remains inside the Liepin adapter because it depends on the site's specific name-container markup. Existing clipboard formatting stays unchanged and receives already-normalized `CandidateDraft` fields.

**Tech Stack:** Chrome MV3, TypeScript 5.8, Vitest/jsdom, Vite/esbuild, PowerShell on Windows.

## Global Constraints

- Only the gender SVG directly beside the Liepin name may set gender: `#FF5833` is `女`, `#085DFF` is `男`, everything else is empty.
- Only one CJK surname followed by one or more half-width/full-width stars may become `姓先生` or `姓女士`; full names and unknown formats remain unchanged.
- Age output is one to three decimal digits with no `岁`; invalid or ambiguous input is empty.
- Current and expected locations keep the city-level first segment and never truncate an undelimited city by character count.
- A district/county/province-only value without a city is empty rather than inferred.
- The clipboard output remains one headerless 11-column TSV row with gender in column 3.
- Missing or unrecognized demographic/location fields never prevent copying other fields.

---

### Task 1: Pure candidate field normalizers

**Files:**
- Create: `extension/src/shared/candidate-normalization.ts`
- Create: `extension/src/shared/candidate-normalization.test.ts`

**Interfaces:**
- Produces: `normalizeMaskedName(name: string, gender: "" | "男" | "女"): string`.
- Produces: `normalizeAge(age: string): string`.
- Produces: `normalizeCityLevelLocation(location: string): string`.

- [ ] **Step 1: Write failing pure-function tests**

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeAge,
  normalizeCityLevelLocation,
  normalizeMaskedName,
} from "./candidate-normalization";

describe("normalizeMaskedName", () => {
  it.each([
    ["张**", "男", "张先生"],
    ["李＊", "女", "李女士"],
    ["张**", "", "张**"],
    ["王小明", "男", "王小明"],
    ["赵先生", "男", "赵先生"],
    ["欧阳**", "男", "欧阳**"],
  ] as const)("normalizes %s with %s", (name, gender, expected) => {
    expect(normalizeMaskedName(name, gender)).toBe(expected);
  });
});

describe("normalizeAge", () => {
  it.each([
    ["31岁", "31"], ["31", "31"], [" 31 岁 ", "31"],
    ["30-35岁", ""], ["1993年出生", ""], ["", ""],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeAge(value)).toBe(expected);
  });
});

describe("normalizeCityLevelLocation", () => {
  it.each([
    ["上海-浦东新区", "上海"], ["杭州/余杭区", "杭州"],
    ["深圳—南山区", "深圳"], ["呼和浩特", "呼和浩特"],
    ["浦东新区", ""], ["广东省", ""], ["", ""],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeCityLevelLocation(value)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/shared/candidate-normalization.test.ts`

Expected: FAIL because `candidate-normalization.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure functions**

```ts
type Gender = "" | "男" | "女";

export function normalizeMaskedName(name: string, gender: Gender): string {
  const trimmed = name.trim();
  const masked = trimmed.match(/^([\u3400-\u9fff])(?:\*|＊)+$/u);
  if (!masked || !gender) return trimmed;
  return `${masked[1]}${gender === "男" ? "先生" : "女士"}`;
}

export function normalizeAge(age: string): string {
  return age.trim().match(/^(\d{1,3})\s*岁?$/)?.[1] ?? "";
}

export function normalizeCityLevelLocation(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "";
  const first = trimmed.split(/\s*[-－—/\\]\s*/).find(Boolean) ?? "";
  if (/(?:自治区|省|区|县)$/.test(first) && !/市/.test(first)) return "";
  return first;
}
```

- [ ] **Step 4: Run the focused tests and verify green**

Run: `Set-Location extension; npm.cmd test -- --run src/shared/candidate-normalization.test.ts`

Expected: all parameterized normalization cases PASS.

- [ ] **Step 5: Commit the pure normalizers**

```powershell
git add extension/src/shared/candidate-normalization.ts extension/src/shared/candidate-normalization.test.ts
git commit -m "feat: normalize copied candidate fields"
```

### Task 2: Integrate gender and normalization into both parsers

**Files:**
- Modify: `extension/src/liepin/card-parser.ts`
- Modify: `extension/src/liepin/card-parser.test.ts`
- Modify: `extension/src/shared/card-fields.ts`
- Modify: `extension/src/maimai/card-parser.test.ts`
- Modify: `tests/fixtures/liepin/list-live-structure.html`
- Modify: `tests/fixtures/maimai/list-normal.html`

**Interfaces:**
- Consumes: the three pure functions from Task 1.
- Produces: normalized `CandidateDraft.name`, `.gender`, `.age`, `.current_location`, and `.preferred_location` from the existing parser entry points.

- [ ] **Step 1: Change the anonymous live Liepin fixture and expectations**

Change the fixture name to `陈**`, add a direct sibling gender span containing the observed female SVG marker `#FF5833`, change current location to `上海-浦东新区`, and expected location to `杭州-余杭区`. The parser expectation becomes:

```ts
expect(parsed).toMatchObject({
  name: "陈女士",
  gender: "女",
  age: "31",
  current_location: "上海",
  preferred_location: "杭州",
});
```

Add an inline live-style card with `赵**`, the observed blue `#085DFF` male SVG, and an unrelated red file SVG elsewhere in the card; expect `赵先生`, `男`, and numeric age. Add another card whose name container lacks a gender SVG but whose body contains the red file icon; expect blank gender and the masked name unchanged.

- [ ] **Step 2: Change the generic and Maimai expectations**

Update the generic Liepin expected age from `31岁` to `31`. Add district suffixes to the fixture's two location fields and expect city-level output. Extend the Maimai fixture with `31岁`, `北京-朝阳区`, and `上海/浦东新区`; expect `31`, `北京`, and `上海` while existing fields stay unchanged.

- [ ] **Step 3: Run parser tests and verify red**

Run: `Set-Location extension; npm.cmd test -- --run src/liepin/card-parser.test.ts src/maimai/card-parser.test.ts`

Expected: FAIL because the parsers still return blank live gender, masked names, `岁`, and district suffixes.

- [ ] **Step 4: Normalize the shared visible-card parser**

Import the three shared functions in `shared/card-fields.ts`. Convert explicit gender text to the existing union, then construct fields with:

```ts
const normalizedGender = gender === "男" || gender === "女" ? gender : "";
name: normalizeMaskedName(name, normalizedGender),
gender: normalizedGender,
age: normalizeAge(firstVisibleText(card, selectors.age)),
current_location: normalizeCityLevelLocation(
  firstVisibleText(card, selectors.current_location),
),
preferred_location: normalizeCityLevelLocation(
  firstVisibleText(card, selectors.preferred_location),
),
```

Leave the stable-id, company/role guard, schools, role, and bachelor year behavior unchanged.

- [ ] **Step 5: Read only the direct Liepin gender SVG**

In `liepin/card-parser.ts`, identify the name element and its next direct `span.anticon` sibling inside `.new-resume-personal-name`. Inspect only that sibling's SVG markup in uppercase. Return empty if both/neither tokens exist; otherwise map `#FF5833` to `女` and `#085DFF` to `男`.

```ts
function liveGender(card: HTMLElement): "" | "男" | "女" {
  const name = card.querySelector(".new-resume-personal-name > em");
  const icon = name?.nextElementSibling;
  if (!(icon instanceof HTMLElement) || !icon.matches("span.anticon")) return "";
  const svg = icon.querySelector("svg")?.outerHTML.toUpperCase() ?? "";
  const female = svg.includes("#FF5833");
  const male = svg.includes("#085DFF");
  if (female === male) return "";
  return female ? "女" : "男";
}
```

Use the returned gender to normalize the live name, age, current location, and expected location through Task 1 functions. Do not scan other icons.

- [ ] **Step 6: Run parser and clipboard regressions**

Run: `Set-Location extension; npm.cmd test -- --run src/liepin/card-parser.test.ts src/maimai/card-parser.test.ts src/export/clipboard-row.test.ts src/content/liepin.test.ts src/content/maimai.test.ts`

Expected: all selected tests PASS and copied rows remain 11 columns.

- [ ] **Step 7: Commit parser integration**

```powershell
git add extension/src/liepin/card-parser.ts extension/src/liepin/card-parser.test.ts extension/src/shared/card-fields.ts extension/src/maimai/card-parser.test.ts tests/fixtures/liepin/list-live-structure.html tests/fixtures/maimai/list-normal.html
git commit -m "feat: copy normalized candidate demographics"
```

### Task 3: Verify, install, and hand off

**Files:**
- Build output: `extension/dist/*`
- Installed copy: `C:\Users\shawnxu\AppData\Local\CandidateCollector\extension`
- Installed copy: `C:\Users\shawnxu\Desktop\候选人采集插件`

**Interfaces:**
- Consumes: normalized parser output from Task 2.
- Produces: both existing extension installation directories updated in place.

- [ ] **Step 1: Run fresh full verification**

Run: `Set-Location extension; npm.cmd test -- --run`

Expected: all tests PASS with zero failures.

Run: `Set-Location extension; npm.cmd run typecheck`

Expected: exit code 0.

Run: `Set-Location extension; npm.cmd run build`

Expected: background, Liepin, Maimai, and side-panel bundles build successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Update the existing installation directories**

Resolve the source and both exact targets. Copy only `manifest.json`, `sidepanel.html`, and files under `dist` with `Copy-Item -LiteralPath ... -Force`, creating missing subdirectories but deleting nothing.

- [ ] **Step 3: Verify installed SHA256 hashes**

Compare every copied file between the source build and both targets using `Get-FileHash -Algorithm SHA256`.

Expected: all corresponding hashes match.

- [ ] **Step 4: Ask the user to reload and complete live acceptance**

After the user reloads the unpacked extension, click one masked-name Liepin card. Validate without printing candidate values that clipboard text has 11 cells, name ends with the gender-appropriate `先生/女士`, gender is `男/女`, age matches `^\d{1,3}$`, and current/expected locations contain none of the observed district hierarchy separator suffixes. Keep the page open for user handoff.

- [ ] **Step 5: Record repository state**

Run: `git status --short` and `git log -6 --oneline`.

Expected: the new feature commits are present; unrelated pre-existing dirty files remain untouched.
