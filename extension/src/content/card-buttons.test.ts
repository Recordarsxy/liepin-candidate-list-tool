import { describe, expect, it, vi } from "vitest";

import type { CandidateDraft } from "../contracts/candidate";
import { installCardButtons } from "./card-buttons";

const makeDraft = (id: string): CandidateDraft => ({
  platform: "liepin",
  platform_candidate_id: id,
  source_page_type: "list",
  current_company: "Northwind Capital",
  name: id === "1" ? "陈女士" : "赵先生",
  gender: id === "1" ? "女" : "男",
  age: "31",
  current_location: "上海",
  preferred_location: "杭州",
  current_role: "机构销售",
  master_school: "",
  bachelor_school: "",
  bachelor_start_year: "",
});

const findCards = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));

const parseCard = (card: HTMLElement): CandidateDraft | null =>
  card.dataset.card ? makeDraft(card.dataset.card) : null;

describe("card buttons", () => {
  it("selects two cards and copies two eleven-column rows", async () => {
    document.body.innerHTML = `<article data-card="1"></article><article data-card="2"></article>`;
    const copy = vi.fn().mockResolvedValue(undefined);
    const dispose = installCardButtons({ root: document, findCards, parseCard, copy });
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-candidate-collector-button]"),
    );

    expect(buttons.map((button) => button.textContent)).toEqual([
      "加入批量",
      "加入批量",
    ]);
    expect(buttons[0].style.transform).toBe("translateX(-24px)");
    expect(buttons[0].style.position).toBe("relative");
    expect(buttons[0].style.zIndex).toBe("1");
    expect(buttons[0].style.cssText).not.toContain("2147483647");

    buttons[0].click();
    buttons[1].click();

    expect(buttons.map((button) => button.textContent)).toEqual([
      "已选择",
      "已选择",
    ]);
    const toolbar = document.querySelector<HTMLElement>(
      "[data-candidate-collector-batch]",
    )!;
    expect(toolbar.textContent).toContain("已选 2 人");
    expect(toolbar.style.right).toBe("24px");
    expect(toolbar.style.bottom).toBe("24px");
    expect(toolbar.style.zIndex).toBe("900");
    expect(copy).not.toHaveBeenCalled();

    toolbar.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledOnce());
    const lines = copy.mock.calls[0][0].split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.every((line: string) => line.split("\t").length === 11)).toBe(true);
    await vi.waitFor(() => expect(buttons[0].textContent).toBe("加入批量"));
    expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
    dispose();
  });

  it("clicking a selected card again cancels it", () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy: vi.fn(),
    });
    const button = document.querySelector<HTMLButtonElement>("button")!;

    button.click();
    button.click();

    expect(button.textContent).toBe("加入批量");
    expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
    dispose();
  });

  it("manual clear resets all selected card buttons", () => {
    document.body.innerHTML = `<article data-card="1"></article><article data-card="2"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy: vi.fn(),
    });
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(
      "[data-candidate-collector-button]",
    ));
    buttons.forEach((button) => button.click());

    document.querySelector<HTMLButtonElement>("[data-action='clear-batch']")?.click();

    expect(buttons.map((button) => button.textContent)).toEqual([
      "加入批量",
      "加入批量",
    ]);
    expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
    dispose();
  });

  it("keeps selected cards when clipboard writing fails", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy: vi.fn().mockRejectedValue(new Error("剪贴板被浏览器拒绝")),
    });
    const cardButton = document.querySelector<HTMLButtonElement>(
      "[data-candidate-collector-button]",
    )!;
    cardButton.click();
    const copyButton = document.querySelector<HTMLButtonElement>(
      "[data-action='copy-batch']",
    )!;
    copyButton.click();

    await vi.waitFor(() => expect(copyButton.textContent).toBe("重试"));
    expect(copyButton.title).toBe("剪贴板被浏览器拒绝");
    expect(cardButton.textContent).toBe("已选择");
    expect(document.body.textContent).toContain("已选 1 人");
    dispose();
  });

  it("marks an unparseable card without adding a row", () => {
    document.body.innerHTML = `<article data-card=""></article>`;
    const copy = vi.fn();
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy,
    });
    const button = document.querySelector<HTMLButtonElement>("button")!;

    button.click();

    expect(button.textContent).toBe("暂时无法识别");
    expect(button.disabled).toBe(true);
    expect(copy).not.toHaveBeenCalled();
    expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
    dispose();
  });

  it("injects a button into cards loaded later", async () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy: vi.fn(),
    });

    document.body.insertAdjacentHTML("beforeend", `<article data-card="2"></article>`);

    await vi.waitFor(() =>
      expect(document.querySelectorAll("[data-candidate-collector-button]")).toHaveLength(2),
    );
    dispose();
  });

  it("removes buttons and the toolbar when disposed", () => {
    document.body.innerHTML = `<article data-card="1"></article>`;
    const dispose = installCardButtons({
      root: document,
      findCards,
      parseCard,
      copy: vi.fn(),
    });
    document.querySelector<HTMLButtonElement>("[data-candidate-collector-button]")?.click();

    dispose();

    expect(document.querySelector("[data-candidate-collector-button]")).toBeNull();
    expect(document.querySelector("[data-candidate-collector-batch]")).toBeNull();
  });
});
