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
    expect(findMaimaiCommunicationAction(cards[0])).not.toBeNull();
    expect(findMaimaiCommunicationAction(cards[1])).not.toBeNull();
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
      age: "29",
      current_location: "北京",
      preferred_location: "北京",
      current_role: "行业顾问",
      master_school: "示例大学",
      bachelor_school: "示例学院",
      bachelor_start_year: "2014",
    });

    expect(parseMaimaiCard(cards[1])).toMatchObject({
      bachelor_school: "",
      bachelor_start_year: "",
    });
  });
});
