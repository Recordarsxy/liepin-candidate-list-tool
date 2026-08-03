import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findLiepinCards, parseLiepinCard } from "./card-parser";

describe("Liepin card parser", () => {
  it("parses the stable fields and structured history from a live-style card", () => {
    document.body.innerHTML = readFileSync(
      resolve(process.cwd(), "../tests/fixtures/liepin/list-live-structure.html"),
      "utf8",
    );
    const card = document.querySelector<HTMLElement>(".live-card");
    const parsed = card ? parseLiepinCard(card) : null;

    expect(findLiepinCards(document)).toEqual(card ? [card] : []);
    expect(parsed).toMatchObject({
      platform: "liepin",
      platform_candidate_id: "lp-live-1",
      name: "陈女士",
      gender: "女",
      age: "31",
      current_location: "上海",
      preferred_location: "杭州",
      current_role: "高级客户经理",
      current_company: "Northwind Capital",
      master_school: "Contoso University",
      bachelor_school: "Fabrikam University",
      bachelor_start_year: "2015",
    });
  });

  it("extracts only visible eleven-column card fields", () => {
    document.body.innerHTML = readFileSync(
      resolve(process.cwd(), "../tests/fixtures/liepin/list-normal.html"),
      "utf8",
    );

    const cards = findLiepinCards(document);

    expect(cards).toHaveLength(1);
    expect(parseLiepinCard(cards[0])).toEqual({
      platform: "liepin",
      platform_candidate_id: "fixture-lp-001",
      source_page_type: "list",
      current_company: "Northwind Capital",
      name: "陈女士",
      gender: "女",
      age: "31",
      current_location: "上海",
      preferred_location: "杭州",
      current_role: "机构销售",
      master_school: "复旦大学",
      bachelor_school: "浙江大学",
      bachelor_start_year: "2012",
    });
  });

  it("rejects cards without a visible name and company or role", () => {
    const card = document.createElement("article");
    card.innerHTML = `<span data-field="age">31岁</span>`;

    expect(parseLiepinCard(card)).toBeNull();
  });

  it("reads the blue name-adjacent icon without using another red icon", () => {
    const card = document.createElement("article");
    card.className = "tlog-common-resume-card";
    card.innerHTML = `
      <div class="new-resume-personal-name">
        <em>赵**</em>
        <span class="anticon"><svg><circle fill="#085DFF"></circle></svg></span>
      </div>
      <span class="personal-detail-age">42岁</span>
      <span class="personal-detail-dq">深圳—南山区</span>
      <div class="new-resume-personal-expect">
        <span class="personal-expect-content"><span>广州/天河区</span><span>销售总监</span></span>
      </div>
      <span class="anticon anticon-file-text"><svg><path fill="#FF5833"></path></svg></span>`;

    expect(parseLiepinCard(card)).toMatchObject({
      name: "赵先生",
      gender: "男",
      age: "42",
      current_location: "深圳",
      preferred_location: "广州",
    });
  });

  it("does not infer gender from an unrelated red icon", () => {
    const card = document.createElement("article");
    card.className = "tlog-common-resume-card";
    card.innerHTML = `
      <div class="new-resume-personal-name"><em>孙**</em></div>
      <div class="new-resume-personal-expect">
        <span class="personal-expect-content"><span>上海</span><span>客户经理</span></span>
      </div>
      <span class="anticon anticon-file-text"><svg><path fill="#FF5833"></path></svg></span>`;

    expect(parseLiepinCard(card)).toMatchObject({
      name: "孙**",
      gender: "",
    });
  });
});
