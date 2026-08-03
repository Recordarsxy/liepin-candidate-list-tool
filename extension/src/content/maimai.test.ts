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
    try {
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
      const cells = rows.map((row: string) => row.split("\t"));
      expect(cells[0].slice(1, 6)).toEqual(["陈先生", "男", "", "北京", "北京"]);
      expect(cells[1].slice(1, 6)).toEqual(["周女士", "", "34", "西安", ""]);
    } finally {
      dispose();
    }
  });

  it("mounts beside an exact nested communication label", () => {
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
      const label = document.querySelector<HTMLElement>(".label")!;
      expect(label.previousElementSibling).toMatchObject({ textContent: "加入批量" });
    } finally {
      dispose();
    }
  });

  it("mounts immediately before an ordinary direct control", () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong><span>29岁</span><span>北京</span>
        <span>期望：</span><span>北京</span><span>20k-30k</span><span>解决方案顾问</span>
        <div><span>2022.03 - 至今</span><span>示例科技</span><span>行业顾问</span></div>
        <div class="ordinary">沟通</div>
      </section>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    const action = document.querySelector<HTMLElement>(".ordinary")!;
    try {
      expect(action.previousElementSibling).toMatchObject({ textContent: "加入批量" });
      expect(action.querySelector("[data-candidate-collector-button]")).toBeNull();
    } finally {
      dispose();
    }
  });

  it("mounts and selects a name-only row from its communication action", async () => {
    document.body.innerHTML = `
      <section>
        <strong>王先生</strong>
        <div class="ordinary">立即沟通</div>
      </section>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    const action = document.querySelector<HTMLElement>(".ordinary")!;
    try {
      const collect = document.querySelector<HTMLButtonElement>(
        "[data-candidate-collector-button]",
      );
      expect(action.previousElementSibling).toBe(collect);
      expect(collect?.textContent).toBe("加入批量");

      collect?.click();
      expect(collect?.textContent).toBe("已选择");
      document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

      const cells = writeText.mock.calls[0][0].split("\t");
      expect(cells).toHaveLength(11);
      expect(cells[1]).toBe("王先生");
      expect(cells.slice(2, 10)).toEqual(["", "", "", "", "", "", "", ""]);
      expect(cells[10]).toBe("脉脉");
    } finally {
      dispose();
    }
  });

  it("mounts one button for each exact action sharing a parent", () => {
    document.body.innerHTML = `
      <div class="shared-actions">
        <span class="first-action">沟通</span>
        <span class="second-action">立即沟通</span>
      </div>`;
    const dispose = installMaimaiCardButtons(document, vi.fn());

    try {
      expect(
        document.querySelectorAll("[data-candidate-collector-button]"),
      ).toHaveLength(2);
      expect(
        document.querySelector<HTMLElement>(".first-action")?.previousElementSibling,
      ).toMatchObject({ textContent: "加入批量" });
      expect(
        document.querySelector<HTMLElement>(".second-action")?.previousElementSibling,
      ).toMatchObject({ textContent: "加入批量" });
    } finally {
      dispose();
    }
  });
});
