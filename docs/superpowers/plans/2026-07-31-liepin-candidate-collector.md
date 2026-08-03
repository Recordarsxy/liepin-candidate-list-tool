Exit code: 0
Wall time: 0.8 seconds
Output:
# Shared Finance Candidate Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a local Windows/Chrome V1 shared candidate store that collects complete nine-column talent lists and produces job-specific recommendations from the same candidates.

**Architecture:** A Python localhost helper owns SQLite, hard rules, job-rule versions, queues, DPAPI credentials, OpenAI analysis and TSV creation. A minimal MV3 extension reads only user-triggered visible DOM from Liepin and Maimai, sends structured captures to the helper, and provides review/copy UI. Platform parsing is isolated behind adapters; candidate collection always feeds the shared store before job prioritisation.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, SQLite, pytest, Ruff, TypeScript, Chrome Manifest V3, Vitest, OpenAI Responses API, Windows DPAPI, PyInstaller.

## Global Constraints

- V1 supports Liepin and Maimai only; LinkedIn is excluded because automated LinkedIn extensions are prohibited by LinkedIn official rules.
- User-triggered visible-DOM reads only. No automatic search, pagination, navigation, contacts, contact-button clicks, favourites, private endpoints, request interception, Cookie access, CAPTCHA bypass or platform automation.
- Every candidate passing the broad finance channel/institution/interbank sales pool enters the detail queue. Recommended candidates receive deep job analysis first; every remaining candidate still receives nine-column enrichment.
- Job intake is pasted chat text. Parsed rules remain a draft until user approval creates a versioned active rule.
- Every page scan evaluates every active job and shows the top one to three matching jobs.
- The only assessment values are `recommend`, `reject`, and `needs_review`; each result stores one to three evidence items or explicit contrary evidence.
- The DingTalk data row has exactly this nine-column order: `目前公司～姓名／性别～年龄／目前地点～期望地点／目前岗位～硕士学校／本科学校`.
- V1 copies data rows only as headerless TSV to the clipboard. It does not call DingTalk APIs.
- Maimai attempts user-triggered visible-DOM parsing first; its fallback parses text manually copied from the current page. Missing fallback fields are blank and flagged, never inferred.
- Store structured career evidence only, never raw full resume page text.
- OpenAI uses Responses API with `gpt-5.6-terra`, `medium` reasoning effort, and structured output. Remove candidate name, platform ID, contacts and URLs before requests. API failure keeps extraction and hard rules running and makes complex matching `needs_review`.
- API keys use Windows DPAPI. Logs contain no candidate text, credentials, cookies, request bodies or secrets.

---

### Task 1: Establish helper core, shared store, rules, and Liepin capture

**Files:**

- Create: `helper/pyproject.toml`
- Create: `helper/src/candidate_store/domain/models.py`
- Create: `helper/src/candidate_store/domain/pool_rules.py`
- Create: `helper/src/candidate_store/domain/nine_columns.py`
- Create: `helper/src/candidate_store/storage/repository.py`
- Create: `helper/src/candidate_store/queue/service.py`
- Create: `helper/src/candidate_store/api/routes.py`
- Create: `helper/tests/domain/test_pool_rules.py`
- Create: `helper/tests/domain/test_nine_columns.py`
- Create: `helper/tests/storage/test_repository.py`
- Create: `extension/package.json`
- Create: `extension/src/liepin/parser.ts`
- Create: `extension/src/liepin/parser.test.ts`
- Create: `extension/src/liepin/page-state.ts`
- Create: `extension/manifest.json`
- Create: `tests/fixtures/liepin/list-normal.html`
- Create: `tests/fixtures/liepin/detail-normal.html`

**Interfaces:**

- Consumes: anonymised visible Liepin card/detail fields and a user-triggered scan request.
- Produces: `CandidateCapture`, `PoolAssessment`, `DetailQueueItem`, nine-column draft and `POST /captures/liepin` response.

- [ ] **Step 1: Write failing helper-domain tests**

  Test a current finance channel, institution and interbank sales title as `recommend`; test an explicit non-sales exclusion as `reject` with contrary evidence; test ambiguous current role as `needs_review`. Test the exact nine-field order, empty unknown values and absence of technical fields.

- [ ] **Step 2: Run the focused tests and confirm red**

  Run: `Set-Location helper; python -m pytest tests/domain -q`
  Expected: failure because the domain modules do not yet exist.

- [ ] **Step 3: Implement the minimal helper core**

  Add typed Pydantic models with the three allowed outcomes, 1–3 evidence-item validation, broad-pool hard rules, exact nine-column mapping, SQLite candidate/career-evidence/source tables and durable queue entries. Insert every broad-pool `recommend` candidate into `nine_column_enrichment`; insert ambiguous candidates only after explicit user review. Never persist raw HTML or full-page text.

- [ ] **Step 4: Add failing Liepin parser tests, then implement the parser**

  Cover visible card extraction, stable platform ID, current role, current company and detail education fields; cover DOM mismatch and login/CAPTCHA state as a paused result. Implement pure DOM parsing with no network, Cookie or navigation API usage.

- [ ] **Step 5: Run helper and extension unit tests**

  Run: `Set-Location helper; python -m pytest tests/domain tests/storage -q; Set-Location ..\extension; npm test -- --run`
  Expected: all focused tests pass.

- [ ] **Step 6: Commit the self-contained core**

  Run: `git add helper extension tests; git commit -m "feat: add shared candidate core and Liepin capture"`

### Task 2: Add Liepin workflow UI and headerless TSV export

**Files:**

- Create: `extension/src/content/liepin.ts`
- Create: `extension/src/sidepanel/app.ts`
- Create: `extension/src/sidepanel/review.ts`
- Create: `helper/src/candidate_store/export/tsv.py`
- Create: `helper/tests/export/test_tsv.py`
- Create: `extension/src/sidepanel/review.test.ts`
- Modify: `helper/src/candidate_store/api/routes.py`

**Interfaces:**

- Consumes: stored candidates, user review edits and user click to copy.
- Produces: reviewed nine-column rows and a clipboard payload with no header.

- [ ] **Step 1: Write failing export and review tests**

  Assert that one and multiple rows contain exactly nine tab-separated fields, no header, no candidate key, and newline-separated records. Assert unreviewed records cannot be copied and unknown fields remain blank.

- [ ] **Step 2: Run the tests and confirm red**

  Run: `Set-Location helper; python -m pytest tests/export -q; Set-Location ..\extension; npm test -- --run`
  Expected: failure because TSV and review components are absent.

- [ ] **Step 3: Implement review and copy actions**

  Expose local endpoints for candidate review and TSV preparation. Build the side-panel action that lets the user review nine fields and explicitly copy headerless TSV data rows to the clipboard. Do not implement DingTalk requests, tokens, APIs or system-index records.

- [ ] **Step 4: Add content-script integration tests and implementation**

  Verify that scanning starts only after the user clicks the extension action, posts parsed visible fields to localhost, and stops on blocked page state. Verify the manifest has neither `cookies` nor `webRequest` permissions.

- [ ] **Step 5: Run the complete Task 1–2 checks**

  Run: `Set-Location extension; npm test -- --run; npm run build; Set-Location ..\helper; python -m pytest -q; python -m ruff check .`
  Expected: all commands exit 0.

- [ ] **Step 6: Commit the Liepin collection workflow**

  Run: `git add helper extension; git commit -m "feat: add Liepin review and TSV export"`

### Task 3: Implement versioned job intake and all-active-job matching

**Files:**

- Create: `helper/src/candidate_store/jobs/intake.py`
- Create: `helper/src/candidate_store/jobs/repository.py`
- Create: `helper/src/candidate_store/jobs/matcher.py`
- Create: `helper/tests/jobs/test_intake.py`
- Create: `helper/tests/jobs/test_matching.py`
- Create: `extension/src/sidepanel/jobs.ts`
- Create: `extension/src/sidepanel/jobs.test.ts`
- Modify: `helper/src/candidate_store/storage/repository.py`
- Modify: `helper/src/candidate_store/api/routes.py`

**Interfaces:**

- Consumes: pasted job chat text, approval action, active rule versions and structured career evidence.
- Produces: draft/approved job versions, per-job assessments and top-1–3 display models.

- [ ] **Step 1: Write failing job-intake tests**

  Test that pasted chat text creates a draft with extracted fields and uncertainty evidence, cannot become active without approval, and approval creates a monotonically increasing immutable version. Test that replacing a job activates the new approved version while retaining prior history.

- [ ] **Step 2: Run job-intake tests and confirm red**

  Run: `Set-Location helper; python -m pytest tests/jobs/test_intake.py -q`
  Expected: failure because job services are absent.

- [ ] **Step 3: Implement draft, approval and version persistence**

  Persist minimal job-rule fields, status, version and approval timestamp. Keep pasted text only as the minimum structured extraction provenance needed for review; never log it. Disallow a scan from using draft, rejected or superseded rule versions.

- [ ] **Step 4: Write failing matching tests, then implement matching**

  Test a scan against three active jobs, assessment of every active job, stable ordering, only the top 1–3 non-rejected results in the response, and evidence count 1–3. Test a recommended job creates `recommended_deep_analysis` ahead of but does not remove `nine_column_enrichment`.

- [ ] **Step 5: Add the draft-review UI and run full tests**

  Build explicit edit/approve controls and a scan-result panel displaying the highest 1–3 jobs. Run: `Set-Location extension; npm test -- --run; Set-Location ..\helper; python -m pytest -q`
  Expected: all tests pass.

- [ ] **Step 6: Commit the job workflow**

  Run: `git add helper extension; git commit -m "feat: add approved versioned job matching"`

### Task 4: Add OpenAI structured semantic analysis and secure degradation

**Files:**

- Create: `helper/src/candidate_store/ai/responses.py`
- Create: `helper/src/candidate_store/security/dpapi.py`
- Create: `helper/src/candidate_store/security/redaction.py`
- Create: `helper/tests/ai/test_responses.py`
- Create: `helper/tests/security/test_dpapi.py`
- Create: `helper/tests/security/test_redaction.py`
- Modify: `helper/src/candidate_store/jobs/matcher.py`

**Interfaces:**

- Consumes: de-identified structured career evidence and an active job-rule version.
- Produces: schema-validated semantic evidence or `needs_review` on API failure.

- [ ] **Step 1: Write failing security and client tests**

  Assert Responses API calls use `gpt-5.6-terra`, `medium` reasoning effort and a declared structured-output schema. Assert name, platform ID, contacts and URLs are absent from the request model. Assert DPAPI round-trips a test key and logs contain no candidate text, secret, Cookie or request body.

- [ ] **Step 2: Run focused tests and confirm red**

  Run: `Set-Location helper; python -m pytest tests/ai tests/security -q`
  Expected: failure because the AI and security modules do not yet exist.

- [ ] **Step 3: Implement redaction, DPAPI and Responses client**

  Encrypt API key material with Windows DPAPI. Create a structured request only from redacted evidence; validate the structured response into allowed outcomes and one to three evidence items. Log only anonymous IDs, count, phase and error category.

- [ ] **Step 4: Implement deterministic failure handling**

  Make timeouts, malformed output and authentication errors return `needs_review` with explicit contrary/absence evidence while retaining hard-rule extraction, candidate storage, job assessment records and queues. Do not retry platform capture or change a failure into `reject`.

- [ ] **Step 5: Run helper verification**

  Run: `Set-Location helper; python -m pytest -q; python -m ruff check .`
  Expected: tests and lint exit 0.

- [ ] **Step 6: Commit secure semantic analysis**

  Run: `git add helper; git commit -m "feat: add secure Responses job analysis"`

### Task 5: Add Maimai visible-DOM adapter and manual-text fallback

**Files:**

- Create: `extension/src/maimai/parser.ts`
- Create: `extension/src/maimai/parser.test.ts`
- Create: `extension/src/maimai/fallback.ts`
- Create: `extension/src/maimai/fallback.test.ts`
- Create: `extension/src/content/maimai.ts`
- Create: `tests/fixtures/maimai/list-normal.html`
- Create: `tests/fixtures/maimai/list-fallback.txt`
- Modify: `extension/manifest.json`
- Modify: `helper/src/candidate_store/api/routes.py`

**Interfaces:**

- Consumes: user-triggered current Maimai page DOM or user-pasted current-page text.
- Produces: the common `CandidateCapture` plus explicit missing-field flags and `manual_text_fallback` source.

- [ ] **Step 1: Write failing Maimai parser tests**

  Cover structured candidate/career extraction from a visible DOM fixture, DOM mismatch, blocked state and no network calls. Assert that the capture uses the same helper contract as Liepin.

- [ ] **Step 2: Write failing manual-text fallback tests**

  Cover a partial copied page: extract only explicit fields, return empty strings for unavailable columns, add missing-field flags and `needs_review` evidence, and never derive gender, school, location or ID from context.

- [ ] **Step 3: Run tests and confirm red**

  Run: `Set-Location extension; npm test -- --run`
  Expected: Maimai tests fail because adapters are absent.

- [ ] **Step 4: Implement adapter and fallback UI**

  Add a user-clicked DOM scan. On mismatch, show a paste area labelled as current-page text fallback; submit only after a user click. Send no raw page text to the database: keep parsed evidence, a non-reversible input hash and field-missing flags.

- [ ] **Step 5: Run cross-platform contract checks**

  Run: `Set-Location extension; npm test -- --run; npm run build; Set-Location ..\helper; python -m pytest -q`
  Expected: all commands exit 0.

- [ ] **Step 6: Commit the Maimai adapter**

  Run: `git add extension helper tests; git commit -m "feat: add Maimai visible DOM and text fallback"`

### Task 6: Package, security-verify, and perform real-page acceptance

**Files:**

- Create: `helper/candidate-store.spec`
- Create: `scripts/verify-security.ps1`
- Create: `docs/install-windows.md`
- Create: `docs/acceptance-checklist.md`
- Create: `docs/uninstall-and-delete.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: built helper and extension, authorised real-page sessions, and user-driven acceptance actions.
- Produces: packaged local application, scrubbed verification report and completed acceptance checklist without candidate data.

- [ ] **Step 1: Write failing release-verification tests/scripts**

  Add checks that reject tracked databases, TSV/CSV/XLSX exports, raw candidate fixtures, `.env` files, key patterns, Cookie patterns and forbidden extension permissions. Add a smoke test that the helper binds only `127.0.0.1`.

- [ ] **Step 2: Run verification and confirm red before hardening**

  Run: `powershell -ExecutionPolicy Bypass -File .\scripts\verify-security.ps1`
  Expected: failure until the script and package constraints are implemented.

- [ ] **Step 3: Implement packaging and cleanup guidance**

  Package the helper with PyInstaller, document local install/uninstall, and list user-confirmed deletion of extension, application data, encrypted credential and logs. Do not delete broad paths; cleanup targets must be validated under the application-specific LocalAppData directory.

- [ ] **Step 4: Run security, build and test verification**

  Run: `Set-Location extension; npm ci; npm test -- --run; npm run build; Set-Location ..\helper; python -m pip install -e ".[dev]"; python -m pytest -q; python -m ruff check .; Set-Location ..; powershell -ExecutionPolicy Bypass -File .\scripts\verify-security.ps1; git diff --check`
  Expected: every command exits 0 and no tracked sensitive or candidate data is found.

- [ ] **Step 5: Conduct user-driven real-page acceptance**

  On authorised, manually navigated Liepin and Maimai pages, trigger scans without automatic search or pagination. Create and approve a job rule from pasted chat text; verify all active jobs are assessed, top 1–3 display, recommended deep analysis precedes remaining work, and every pool-qualified candidate still receives nine-column enrichment. Exercise Maimai copied-text fallback, confirm blanks/flags, copy a headerless nine-column TSV, force an AI failure, and confirm `needs_review` while hard rules and extraction continue. Record only counts, software versions and pass/fail outcomes in `docs/acceptance-checklist.md`.

- [ ] **Step 6: Commit release readiness**

  Run: `git add helper extension scripts docs README.md; git commit -m "chore: package and verify candidate store v1"`
