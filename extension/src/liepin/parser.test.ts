import { describe, expect, it } from "vitest";
import parserSource from "./parser.ts?raw";

import { parseLiepinDocument } from "./parser";

const listFixture = `
  <main data-liepin-list>
    <article data-liepin-candidate-id="stable-001">
      <span data-field="name">脱敏候选人</span>
      <span data-field="current-company">甲银行</span>
      <span data-field="current-role">机构及同业渠道销售</span>
      <span data-field="current-location">上海</span>
    </article>
  </main>`;

const detailFixture = `
  <main data-liepin-detail data-liepin-candidate-id="stable-002">
    <span data-field="name">脱敏候选人</span>
    <span data-field="current-company">乙基金</span>
    <span data-field="current-role">机构销售</span>
    <section data-education-level="master"><span data-field="school">甲大学</span></section>
    <section data-education-level="bachelor"><span data-field="school">乙大学</span></section>
  </main>`;

describe("parseLiepinDocument", () => {
  it("extracts visible list-card fields with a stable platform ID", () => {
    const document = new DOMParser().parseFromString(listFixture, "text/html");

    expect(parseLiepinDocument(document)).toEqual({
      status: "ready",
      captures: [
        {
          platform: "liepin",
          platform_candidate_id: "stable-001",
          source_page_type: "list",
          name: "脱敏候选人",
          current_company: "甲银行",
          current_role: "机构及同业渠道销售",
          current_location: "上海",
          career_evidence: [],
        },
      ],
    });
  });

  it("extracts visible current role, company, and detail education fields", () => {
    const document = new DOMParser().parseFromString(detailFixture, "text/html");

    expect(parseLiepinDocument(document)).toEqual({
      status: "ready",
      captures: [
        {
          platform: "liepin",
          platform_candidate_id: "stable-002",
          source_page_type: "detail",
          name: "脱敏候选人",
          current_company: "乙基金",
          current_role: "机构销售",
          master_school: "甲大学",
          bachelor_school: "乙大学",
          career_evidence: [
            {
              company: "乙基金",
              role: "机构销售",
              education_level: "master",
              school: "甲大学",
              source_field: "visible-detail",
            },
            {
              company: "乙基金",
              role: "机构销售",
              education_level: "bachelor",
              school: "乙大学",
              source_field: "visible-detail",
            },
          ],
        },
      ],
    });
  });

  it("returns a paused result when visible DOM does not match a supported page", () => {
    const document = new DOMParser().parseFromString("<main>unrelated page</main>", "text/html");

    expect(parseLiepinDocument(document)).toEqual({ status: "paused", reason: "dom_mismatch" });
  });

  it.each([
    ["<main data-liepin-login>请登录后查看</main>", "login_required"],
    ["<main>请完成验证码验证</main>", "captcha_required"],
  ])("returns a paused result for %s", (html, reason) => {
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(parseLiepinDocument(document)).toEqual({ status: "paused", reason });
  });

  it("uses only the provided visible DOM and no network, cookie, or navigation APIs", () => {
    expect(parserSource).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|document\.cookie|window\.location|document\.location/,
    );
  });
});
