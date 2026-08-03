import { describe, expect, it, vi } from "vitest";

import { installMaimaiCardButtons } from "./maimai";

describe("Maimai content script", () => {
  it("copies two selected cards as two eleven-cell rows", async () => {
    document.body.innerHTML = `
      <article data-maimai-candidate-id="mm-1">
        <span data-field="name">王先生</span>
        <span data-field="current-company">乙公司</span>
        <span data-field="current-role">销售总监</span>
      </article>
      <article data-maimai-candidate-id="mm-2">
        <span data-field="name">李女士</span>
        <span data-field="current-company">丙公司</span>
        <span data-field="current-role">客户经理</span>
      </article>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    document
      .querySelectorAll<HTMLButtonElement>("[data-candidate-collector-button]")
      .forEach((button) => button.click());
    expect(writeText).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const rows = writeText.mock.calls[0][0].split("\n");
    expect(rows).toHaveLength(2);
    expect(rows.every((row: string) => row.split("\t").length === 11)).toBe(true);
    expect(rows.every((row: string) => row.split("\t")[10] === "脉脉")).toBe(true);
    dispose();
  });
});
