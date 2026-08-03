import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { installMaimaiCardButtons } from "./maimai";

const loadMaimaiFixture = (): void => {
  document.body.innerHTML = readFileSync(
    resolve(process.cwd(), "../tests/fixtures/maimai/list-normal.html"),
    "utf8",
  );
};

describe("Maimai content script", () => {
  it("mounts selected card buttons before communication actions and copies two rows", async () => {
    loadMaimaiFixture();
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    const actions = [
      document.querySelector<HTMLElement>(".CommunicationControl_alpha")!,
      document.querySelector<HTMLElement>(".CommunicationControl_beta")!,
    ];

    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action.previousElementSibling).toMatchObject({
        textContent: "\u52a0\u5165\u6279\u91cf",
      });
      expect(action.querySelector("[data-candidate-collector-button]")).toBeNull();
    }

    document
      .querySelectorAll<HTMLButtonElement>("[data-candidate-collector-button]")
      .forEach((button) => button.click());
    document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const rows = writeText.mock.calls[0][0].split("\n");
    expect(rows).toHaveLength(2);
    expect(rows.every((row: string) => row.split("\t").length === 11)).toBe(true);
    expect(rows.every((row: string) => row.split("\t")[10] === "\u8109\u8109")).toBe(true);
    dispose();
  });

  it("does not mount a button for a partial nested communication label", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="real-control"><span class="label">立即沟通</span><span>更多</span></div>
      </section>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    try {
      expect(document.querySelector("[data-candidate-collector-button]")).toBeNull();
    } finally {
      dispose();
    }
  });
});
