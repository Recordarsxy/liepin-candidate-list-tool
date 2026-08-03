import { describe, expect, it, vi } from "vitest";

import type { CandidateDraft } from "../contracts/candidate";
import { installCardButtons } from "./card-buttons";

const draft: CandidateDraft = {
  platform: "liepin",
  platform_candidate_id: "lp-1",
  source_page_type: "list",
  current_company: "Northwind Capital",
  name: "陈女士",
  gender: "",
  age: "",
  current_location: "",
  preferred_location: "",
  current_role: "机构销售",
  master_school: "",
  bachelor_school: "",
  bachelor_start_year: "",
};

describe("card buttons", () => {
  it("injects once and captures only after the user clicks", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const capture = vi.fn().mockResolvedValue(undefined);

    const dispose = installCardButtons({
      root: document,
      findCards: (root) => Array.from(root.querySelectorAll<HTMLElement>("[data-card]")),
      parseCard: () => draft,
      capture,
    });
    const button = document.querySelector<HTMLButtonElement>("[data-candidate-collector-button]");
    button?.click();
    await Promise.resolve();

    expect(document.querySelectorAll("[data-candidate-collector-button]")).toHaveLength(1);
    expect(capture).toHaveBeenCalledWith(draft);
    expect(button?.textContent).toBe("已加入");
    dispose();
  });

  it("marks an unparseable card without sending an empty row", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const capture = vi.fn();
    const dispose = installCardButtons({
      root: document,
      findCards: (root) => Array.from(root.querySelectorAll<HTMLElement>("[data-card]")),
      parseCard: () => null,
      capture,
    });

    document.querySelector<HTMLButtonElement>("button")?.click();
    await Promise.resolve();

    expect(capture).not.toHaveBeenCalled();
    expect(document.querySelector("button")?.textContent).toBe("暂时无法识别");
    dispose();
  });

  it("removes injected buttons when disposed", () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards: (root) =>
        Array.from(root.querySelectorAll<HTMLElement>("[data-card]")),
      parseCard: () => draft,
      capture: vi.fn(),
    });

    dispose();

    expect(
      document.querySelector("[data-candidate-collector-button]"),
    ).toBeNull();
  });
});
