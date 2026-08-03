import { describe, expect, it, vi } from "vitest";

import { installMaimaiCardButtons } from "./maimai";

describe("Maimai content script", () => {
  it("copies only the clicked visible card as eleven cells", async () => {
    document.body.innerHTML = `
      <article data-maimai-candidate-id="mm-1">
        <span data-field="name">王先生</span>
        <span data-field="current-company">乙公司</span>
        <span data-field="current-role">销售总监</span>
      </article>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    document.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const cells = writeText.mock.calls[0][0].split("\t");
    expect(cells).toHaveLength(11);
    expect(cells[1]).toBe("王先生");
    expect(cells[10]).toBe("脉脉");
    dispose();
  });
});
