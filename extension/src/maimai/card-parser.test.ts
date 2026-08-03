import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findMaimaiCards, parseMaimaiCard } from "./card-parser";

describe("Maimai card parser", () => {
  it("extracts visible fields and leaves unavailable values blank", () => {
    document.body.innerHTML = readFileSync(
      resolve(process.cwd(), "../tests/fixtures/maimai/list-normal.html"),
      "utf8",
    );

    const cards = findMaimaiCards(document);

    expect(cards).toHaveLength(1);
    expect(parseMaimaiCard(cards[0])).toEqual({
      platform: "maimai",
      platform_candidate_id: "fixture-mm-001",
      source_page_type: "list",
      current_company: "Contoso Securities",
      name: "王先生",
      gender: "",
      age: "31",
      current_location: "北京",
      preferred_location: "上海",
      current_role: "渠道销售",
      master_school: "",
      bachelor_school: "",
      bachelor_start_year: "",
    });
  });
});
