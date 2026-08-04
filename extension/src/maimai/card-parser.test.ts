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

  it("accepts an exact nested communication label even when its parent has extra text", () => {
    document.body.innerHTML = `
      <section class="candidate-row">
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="real-control"><span class="label">立即沟通</span><span>更多</span></div>
      </section>`;
    const row = document.querySelector<HTMLElement>(".candidate-row")!;

    expect(findMaimaiCommunicationAction(row)?.className).toBe("label");
    expect(findMaimaiCards(document)).toHaveLength(1);
  });

  it("accepts exact span and paragraph communication actions without tag requirements", () => {
    document.body.innerHTML = `
      <section><strong>王先生</strong><span class="span-action">沟通</span></section>
      <section><strong>李女士</strong><p class="paragraph-action">立即沟通</p></section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(2);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe("span-action");
    expect(findMaimaiCommunicationAction(cards[1])?.className).toBe("paragraph-action");
  });

  it("returns every exact communication action when actions share a parent", () => {
    document.body.innerHTML = `
      <div class="shared-actions">
        <span class="first-action">沟通</span>
        <span class="second-action">立即沟通</span>
      </div>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.className)).toEqual([
      "first-action",
      "second-action",
    ]);
  });

  it("does not borrow a name from another candidate row", () => {
    document.body.innerHTML = `
      <div class="candidate-list">
        <section class="anonymous-row"><div class="first-action">沟通</div></section>
        <section class="named-row">
          <strong>李女士</strong>
          <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
          <div class="second-action">立即沟通</div>
        </section>
      </div>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(2);
    expect(parseMaimaiCard(cards[0])).toBeNull();
    expect(parseMaimaiCard(cards[1])).toMatchObject({ name: "李女士" });
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

  it("discovers an exact communication action without profile markers", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong>
        <div class="ordinary">立即沟通</div>
      </section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(findMaimaiCommunicationAction(cards[0])?.className).toBe("ordinary");
    expect(parseMaimaiCard(cards[0])).toMatchObject({
      name: "王先生",
      age: "",
      current_company: "",
      current_role: "",
      preferred_location: "",
    });
  });

  it("parses the full row when the nearest named ancestor only contains the action", () => {
    document.body.innerHTML = `
      <section class="full-row">
        <div class="name-action-shell">
          <strong>王先生</strong><span class="ordinary">沟通</span>
        </div>
        <div class="profile-details">
          <span>34岁</span><span>12年</span><span>本科</span><span>广东深圳</span>
        </div>
        <div><span>期望：</span><span>广州/天河区</span><span>机构销售</span></div>
        <div><span>2020.08 - 至今</span><span>示例科技</span><span>机构销售经理</span></div>
        <div><span>2016.09 - 2020.06</span><span>示例大学</span><span>市场营销</span><span>本科</span></div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      name: "王先生",
      age: "34",
      current_location: "深圳",
      preferred_location: "广州",
      current_company: "示例科技",
      current_role: "机构销售经理",
      bachelor_school: "示例大学",
      bachelor_start_year: "2016",
    });
  });

  it("reads a red CSS avatar badge and split list-item work and education rows", () => {
    document.body.innerHTML = `
      <section class="full-row">
        <div class="identity-shell">
          <div class="avatar"><img src="avatar.png"><svg><path style="fill: rgb(255, 88, 51)"></path></svg></div>
          <strong>杜秋萱</strong><span class="ordinary">立即沟通</span>
        </div>
        <div><span>34岁</span><span>12年</span><span>硕士</span><span>北京海淀区</span></div>
        <ul>
          <li><span>2016.10</span><span>-</span><span>2019.09</span><span>国富基金</span><span>高级项目经理</span></li>
          <li><span>2014.09</span><span>-</span><span>2016.06</span><span>清华大学</span><span>金融学</span><span>硕士</span></li>
          <li><span>2010.09</span><span>-</span><span>2014.06</span><span>清华大学</span><span>经济学</span><span>本科</span></li>
        </ul>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      name: "杜秋萱",
      gender: "女",
      age: "34",
      current_location: "北京",
      current_company: "国富基金",
      current_role: "高级项目经理",
      master_school: "清华大学",
      bachelor_school: "清华大学",
      bachelor_start_year: "2010",
    });
  });

  it("merges nested timeline fields and normalizes extended education labels", () => {
    document.body.innerHTML = `
      <section>
        <strong>杜女士</strong><span class="ordinary">沟通</span>
        <div class="work-row">
          <div class="work-header"><span>2016.10 - 2019.09</span><span>国富基金</span></div>
          <span>·</span><span>高级项目经理</span>
        </div>
        <div class="master-row">
          <div class="education-header"><span>2014.09 - 2016.06</span><span>清华大学</span><span>金融学</span></div>
          <span>硕士研究生</span>
        </div>
        <div class="bachelor-row">
          <div class="education-header"><span>2010.09 - 2014.06</span><span>清华大学</span><span>经济学</span></div>
          <span>本科统招</span>
        </div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      current_company: "国富基金",
      current_role: "高级项目经理",
      master_school: "清华大学",
      bachelor_school: "清华大学",
      bachelor_start_year: "2010",
    });
  });

  it("uses an extended education label when selecting the complete candidate root", () => {
    document.body.innerHTML = `
      <section class="full-row">
        <div class="name-action-shell">
          <strong>李女士</strong><span class="ordinary">沟通</span>
        </div>
        <div class="profile-details"><span>本科统招</span><span>广东深圳</span></div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      name: "李女士",
      current_location: "深圳",
    });
  });

  it("does not treat degree words inside companies or roles as education labels", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span class="ordinary">沟通</span>
        <div><span>2022.03 - 至今</span><span>示例研究生院</span><span>MBA项目经理</span></div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      current_company: "示例研究生院",
      current_role: "MBA项目经理",
      master_school: "",
    });
  });

  it("reads a blue CSS avatar badge as male", () => {
    document.body.innerHTML = `
      <section>
        <div class="avatar"><img src="avatar.png"><svg><circle style="stroke: #085DFF"></circle></svg></div>
        <strong>张也冰</strong><span class="ordinary">沟通</span>
        <div><span>2020.08 - 2023.01</span><span>示例公司</span><span>机构销售</span></div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ name: "张也冰", gender: "男" });
  });

  it("does not treat an unrelated blue interactive icon before the name as gender", () => {
    document.body.innerHTML = `
      <section>
        <button aria-label="筛选"><svg><path fill="#085DFF"></path></svg></button>
        <strong>王小明</strong><span class="ordinary">沟通</span>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ name: "王小明", gender: "" });
  });

  it("uses an explicit name honorific when no badge color is available", () => {
    document.body.innerHTML = `
      <section>
        <strong>杨先生</strong><span class="ordinary">沟通</span>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ name: "杨先生", gender: "男" });
  });

  it("separates name and location in a timeline-only sparse row", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>北京</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="ordinary">沟通</div>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      name: "王先生",
      age: "",
      current_location: "北京",
      preferred_location: "",
    });
  });

  it("does not treat a split history period as the current location", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>34岁</span><span>本科</span>
        <div><span>2016.10</span><span>-</span><span>2019.09</span><span>示例公司</span><span>机构销售</span></div>
        <span class="ordinary">沟通</span>
      </section>`;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ current_location: "" });
  });

  it("mounts from the action but does not treat status text as a candidate name", () => {
    document.body.innerHTML = `
      <section>
        <span>近一周活跃</span><span>29岁</span><span>期望：</span>
        <div class="ordinary">沟通</div>
      </section>`;

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(parseMaimaiCard(cards[0])).toBeNull();
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
    expect(cards[0].textContent).toBe("立即沟通");
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

  it("keeps work fields empty when work history has no company or role", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span></div>
        <button>立即沟通</button>
      </section>
    `;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({
      name: "王先生",
      current_company: "",
      current_role: "",
    });
  });

  it("discovers a visible action even when age and expectation markers are hidden", () => {
    document.body.innerHTML = `
      <style>.hidden-by-stylesheet { display: none; }</style>
      <section>
        <strong>王先生</strong>
        <span style="display: none">29岁</span>
        <span class="hidden-by-stylesheet">期望：</span>
        <button>立即沟通</button>
      </section>
    `;

    expect(findMaimaiCards(document)).toHaveLength(1);
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
        <strong>王小明</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <button>立即沟通</button>
      </section>
    `;

    const card = findMaimaiCards(document)[0];

    expect(parseMaimaiCard(card)).toMatchObject({ gender: "" });
  });
});
