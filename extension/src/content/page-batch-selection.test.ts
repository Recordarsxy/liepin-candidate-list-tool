import { describe, expect, it } from "vitest";

import type { CandidateDraft } from "../contracts/candidate";
import { PageBatchSelection } from "./page-batch-selection";

const makeDraft = (id: string | undefined, name: string): CandidateDraft => ({
  platform: "liepin",
  ...(id ? { platform_candidate_id: id } : {}),
  source_page_type: "list",
  current_company: "甲公司",
  name,
  gender: "",
  age: "",
  current_location: "",
  preferred_location: "",
  current_role: "销售",
  master_school: "",
  bachelor_school: "",
  bachelor_start_year: "",
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
