# Maimai Action-First Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Always mount one collection button beside every visible exact Maimai communication action, then parse candidate data on click with missing fields left blank.

**Architecture:** Separate action discovery from candidate parsing. `findMaimaiCards` returns every exact visible communication action without checking candidate fields or element tags; the generic installer marks each returned action as mounted so siblings sharing a parent stay distinct. `parseMaimaiCard` climbs from that action and selects the named safe ancestor with the highest profile/timeline detail score, then parses gender from explicit honorifics or avatar badge colors and parses history from minimal visible elements with complete or split period text.

**Tech Stack:** Chrome MV3, TypeScript, Vitest, jsdom, Vite

## Global Constraints

- Only exact visible `立即沟通` and `沟通` labels create anchors.
- Button visibility must not depend on age, expectation, education, location, or timeline.
- Missing candidate fields remain empty strings in the fixed 11-column clipboard row.
- Liepin behavior, batch selection, copy-and-clear behavior, and the collector toggle remain unchanged.

---

### Task 1: Decouple Maimai button mounting from field recognition

**Files:**
- Modify: `extension/src/maimai/card-parser.test.ts`
- Modify: `extension/src/content/maimai.test.ts`
- Modify: `extension/src/content/card-buttons.ts`
- Modify: `extension/src/maimai/card-parser.ts`

**Interfaces:**
- Consumes: `findMaimaiCards(root)`, `findMaimaiCommunicationAction(card)`, `parseMaimaiCard(card)`
- Produces: mounting containers discovered solely from exact visible communication actions; best-effort candidate drafts resolved from the nearest named ancestor

- [ ] **Step 1: Write the failing tests**

Add parser/content fixtures containing: a name-only row; exact `span`/`p` actions; two actions sharing one parent; and adjacent anonymous/named rows. Assert every action receives one button, missing fields remain empty, and the anonymous row cannot borrow the next row's name.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```powershell
npm.cmd test -- --run src/maimai/card-parser.test.ts src/content/maimai.test.ts
```

Expected: the new no-marker row assertions fail because `findMaimaiCards` currently requires a candidate signature before returning a card.

- [ ] **Step 3: Implement the minimal action-first behavior**

In `visibleCommunicationActions`, stop requiring `hasCandidateSignature` or element tags. In `findMaimaiCards`, return every exact action element. Mark each source action with `data-candidate-collector-mounted` in the generic installer so sibling actions do not collapse or receive duplicates. Add a resolver used by `parseMaimaiCard` that climbs through named ancestors, scores every age/experience/education/expectation/period token, keeps the richest safe ancestor, stops before shared multi-action containers and `body/html`, and excludes communication labels and collector UI from name candidates. Infer gender from `先生/女士`, then from visible avatar SVG computed colors. Parse minimal history elements across all tags and accept period text split across up to three leaf tokens. Relax the final parse guard to require only a reliable name; keep missing work and education fields empty.

- [ ] **Step 4: Verify focused and full GREEN**

Run:

```powershell
npm.cmd test -- --run src/maimai/card-parser.test.ts src/content/maimai.test.ts
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run build
```

Expected: all commands exit 0 and the no-marker row receives one working button.

- [ ] **Step 5: Commit and install**

Commit only the three task files plus the approved design/plan. Copy the six runtime release files (`manifest.json`, `sidepanel.html`, `dist/background.js`, `dist/content/liepin.js`, `dist/content/maimai.js`, `dist/sidepanel/app.js`) to both installed extension directories and verify 6/6 SHA-256 matches.
