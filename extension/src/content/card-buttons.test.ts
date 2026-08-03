import { describe, expect, it, vi } from "vitest";

import type { CandidateDraft } from "../contracts/candidate";
import { candidateToClipboardRow } from "../export/clipboard-row";
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

const findCards = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));

describe("card buttons", () => {
  it("copies the clicked card and allows copying it again", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const copy = vi.fn().mockResolvedValue(undefined);

    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard: () => draft,
      copy,
    });
    const button = document.querySelector<HTMLButtonElement>(
      "[data-candidate-collector-button]",
    )!;
    expect(button.textContent).toBe("复制候选人");

    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe("已复制"));

    expect(document.querySelectorAll("[data-candidate-collector-button]")).toHaveLength(1);
    expect(copy).toHaveBeenCalledWith(candidateToClipboardRow(draft));
    expect(button.disabled).toBe(false);

    button.click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledTimes(2));
    dispose();
  });

  it("marks an unparseable card without changing the clipboard", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const copy = vi.fn();
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard: () => null,
      copy,
    });

    document.querySelector<HTMLButtonElement>("button")?.click();
    await Promise.resolve();

    expect(copy).not.toHaveBeenCalled();
    expect(document.querySelector("button")?.textContent).toBe("暂时无法识别");
    dispose();
  });

  it("injects a button into cards loaded later", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard: () => draft,
      copy: vi.fn(),
    });

    document.body.insertAdjacentHTML("beforeend", `<article data-card="2"></article>`);

    await vi.waitFor(() =>
      expect(document.querySelectorAll("[data-candidate-collector-button]")).toHaveLength(2),
    );
    dispose();
  });

  it("removes injected buttons when disposed", () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard: () => draft,
      copy: vi.fn(),
    });

    dispose();

    expect(document.querySelector("[data-candidate-collector-button]")).toBeNull();
  });

  it("keeps the clipboard error on an enabled retry button", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard: () => draft,
      copy: vi.fn().mockRejectedValue(new Error("剪贴板被浏览器拒绝")),
    });
    const button = document.querySelector<HTMLButtonElement>("button")!;

    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe("重试"));

    expect(button.title).toBe("剪贴板被浏览器拒绝");
    expect(button.disabled).toBe(false);
    dispose();
  });
});
