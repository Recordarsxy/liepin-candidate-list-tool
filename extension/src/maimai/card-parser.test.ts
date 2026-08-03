import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  findMaimaiCards,
  findMaimaiCommunicationAction,
  parseMaimaiCard,
} from "./card-parser";

describe("Maimai card parser", () => {
  it("discovers screenshot-shaped rows and their communication anchors in document order", () => {
    document.body.innerHTML = readFileSync(
      resolve(process.cwd(), "../tests/fixtures/maimai/list-normal.html"),
      "utf8",
    );

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(2);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe(
      "CommunicationControl_alpha",
    );
    expect(findMaimaiCommunicationAction(cards[1])?.className).toBe(
      "CommunicationControl_beta",
    );
  });

  it("expands through decorative control children but not an independent phone sibling", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>期望：</span>
        <div class="ActionGroup">
          <div class="CommunicationControl"><span>立即沟通</span><svg aria-hidden="true"></svg><span class="DecorativeBadge"></span></div>
          <div class="PhoneControl" role="button" aria-label="phone"></div>
        </div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(findMaimaiCommunicationAction(card)?.className).toBe("CommunicationControl");
  });

  it("accepts an ordinary direct control at the candidate-row boundary", () => {
    document.body.innerHTML = `
      <section class="candidate-row">
        <strong>王先生</strong><span>29岁</span><span>期望：</span>
        <div class="ordinary">沟通</div>
      </section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe("ordinary");
  });

  it("accepts a nested ordinary control with a decorative child", () => {
    document.body.innerHTML = `
      <section class="candidate-row">
        <strong>王先生</strong><span>29岁</span><span>期望：</span>
        <div class="ordinary"><span>立即沟通</span><svg aria-hidden="true"></svg></div>
      </section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe("ordinary");
  });

  it("rejects a nested communication label whose parent has additional visible text", () => {
    document.body.innerHTML = `
      <section class="candidate-row">
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="real-control"><span class="label">立即沟通</span><span>更多</span></div>
      </section>`;
    const row = document.querySelector<HTMLElement>(".candidate-row")!;

    expect(findMaimaiCommunicationAction(row)).toBeNull();
    expect(findMaimaiCards(document)).toEqual([]);
  });

  it("parses visible profile, expectation, and history fields", () => {
    document.body.innerHTML = readFileSync(
      resolve(process.cwd(), "../tests/fixtures/maimai/list-normal.html"),
      "utf8",
    );

    const cards = findMaimaiCards(document);

    expect(parseMaimaiCard(cards[0])).toEqual({
      platform: "maimai",
      source_page_type: "list",
      current_company: "示例科技",
      name: "陈先生",
      gender: "男",
      age: "",
      current_location: "北京",
      preferred_location: "北京",
      current_role: "行业顾问",
      master_school: "示例大学",
      bachelor_school: "示例学院",
      bachelor_start_year: "2014",
    });

    expect(parseMaimaiCard(cards[1])).toMatchObject({
      name: "周女士",
      age: "34",
      current_location: "西安",
      preferred_location: "",
      bachelor_school: "",
      bachelor_start_year: "",
    });
  });

  it("discovers a named row from timeline evidence alone", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>求职中</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="ordinary">沟通</div>
      </section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe("ordinary");
  });

  it("does not treat status text as a candidate name", () => {
    document.body.innerHTML = `
      <section>
        <span>近一周活跃</span><span>29岁</span><span>期望：</span>
        <div class="ordinary">沟通</div>
      </section>`;

    expect(findMaimaiCards(document)).toEqual([]);
  });

  it("excludes rows hidden by ancestor display, visibility, and stylesheet rules", () => {
    document.body.innerHTML = `
      <style>.hidden-by-stylesheet { display: none; }</style>
      <section class="visible-row"><strong>王先生</strong><span>29岁</span><span>期望：</span><button>立即沟通</button></section>
      <section style="display: none"><strong>李女士</strong><span>30岁</span><span>期望：</span><button>立即沟通</button></section>
      <section style="visibility: hidden"><strong>赵先生</strong><span>31岁</span><span>期望：</span><button>立即沟通</button></section>
      <section class="hidden-by-stylesheet"><strong>孙女士</strong><span>32岁</span><span>期望：</span><button>立即沟通</button></section>
    `;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(cards[0].className).toBe("visible-row");
  });

  it("excludes fields hidden by ancestor display, visibility, and stylesheet rules", () => {
    document.body.innerHTML = `
      <style>.hidden-by-stylesheet { display: none; }</style>
      <section>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div style="display: none"><span>2018.09 - 2021.06</span><span>隐藏大学</span><span>电子信息</span><span>硕士</span></div>
        <div style="visibility: hidden"><span>2014.09 - 2018.06</span><span>隐藏学院</span><span>自动化</span><span>本科</span></div>
        <div class="hidden-by-stylesheet"><span>2017.09 - 2020.06</span><span>样式大学</span><span>金融</span><span>硕士</span></div>
        <button>立即沟通</button>
      </section>
    `;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      master_school: "",
      bachelor_school: "",
      bachelor_start_year: "",
    });
  });

  it("rejects an expectation-only role when work history has no company or role", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span></div>
        <button>立即沟通</button>
      </section>
    `;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toBeNull();
  });

  it("does not discover a visible action when age and expectation markers are hidden", () => {
    document.body.innerHTML = `
      <style>.hidden-by-stylesheet { display: none; }</style>
      <section>
        <strong>王先生</strong>
        <span style="display: none">29岁</span>
        <span class="hidden-by-stylesheet">期望：</span>
        <button>立即沟通</button>
      </section>
    `;

    expect(findMaimaiCards(document)).toEqual([]);
  });

  it("does not discover a hidden nested communication label", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>期望：</span>
        <div style="display:none"><span>沟通</span></div>
      </section>`;

    expect(findMaimaiCards(document)).toEqual([]);
  });

  it("does not derive gender from a hidden SVG color icon", () => {
    document.body.innerHTML = `
      <section>
        <div style="visibility: hidden"><svg><path fill="#085DFF"></path></svg></div>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <button>立即沟通</button>
      </section>
    `;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ gender: "" });
  });
});
