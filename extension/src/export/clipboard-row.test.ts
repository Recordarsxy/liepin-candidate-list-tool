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
      "甲 公司",
      "陈女士",
      "女",
      "31岁",
      "上海",
      "杭州 上海",
      "机构销售",
      "复旦大学",
      "浙江大学",
      "2013",
      "猎聘",
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
      "甲 公司",
      "陈女士",
      "",
      "31岁",
      "上海",
      "杭州 上海",
      "机构销售",
      "",
      "浙江大学",
      "",
      "脉脉",
    ]);
  });
});
