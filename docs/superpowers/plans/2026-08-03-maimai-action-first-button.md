# Maimai Action-First Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Always mount one collection button beside every visible exact Maimai communication action, then parse candidate data on click with missing fields left blank.

**Architecture:** Separate action discovery from candidate parsing. `findMaimaiCards` returns the communication action's mounting container without checking candidate fields; `parseMaimaiCard` climbs from that container to the nearest ancestor containing a reliable name before applying existing best-effort field parsing.

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
- Modify: `extension/src/maimai/card-parser.ts`

**Interfaces:**
- Consumes: `findMaimaiCards(root)`, `findMaimaiCommunicationAction(card)`, `parseMaimaiCard(card)`
- Produces: mounting containers discovered solely from exact visible communication actions; best-effort candidate drafts resolved from the nearest named ancestor

- [ ] **Step 1: Write the failing tests**

Add a parser/content fixture containing only a reliable candidate name and an exact visible `立即沟通` action. Assert one mounting container is found, the action is returned, the content script inserts exactly one `加入批量` before it, and clicking selects a draft whose missing values remain empty.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```powershell
npm.cmd test -- --run src/maimai/card-parser.test.ts src/content/maimai.test.ts
```

Expected: the new no-marker row assertions fail because `findMaimaiCards` currently requires a candidate signature before returning a card.

- [ ] **Step 3: Implement the minimal action-first behavior**

In `visibleCommunicationActions`, stop requiring `hasCandidateSignature` when the exact-label action reaches an ancestor with different text. In `findMaimaiCards`, return the action's mounting parent without inspecting candidate fields. Add a resolver used by `parseMaimaiCard` that climbs to the nearest ancestor with a reliable profile name, and exclude communication labels from name candidates. Relax the final parse guard to require only a reliable name; keep missing work and education fields empty.

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

