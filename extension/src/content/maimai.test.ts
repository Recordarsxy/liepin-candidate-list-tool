import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { installMaimaiCardButtons } from "./maimai";

const loadAnonymousFixture = (): string => {
  document.body.innerHTML = readFileSync(
    resolve(process.cwd(), "../tests/fixtures/maimai/list-normal.html"),
    "utf8",
  );
  return document.querySelector<HTMLElement>(".TalentRow_beta")!.outerHTML;
};

describe("Maimai content script", () => {
  it("mounts selected card buttons before communication actions and copies two rows", async () => {
    const anonymousFixture = loadAnonymousFixture();
    document.body.innerHTML = [
      anonymousFixture
        .replace("\u5468\u5973\u58eb", "\u738b\u5973\u58eb")
        .replace("\u533f\u540d\u7814\u7a76\u9662", "\u5317\u6781\u661f\u7814\u7a76\u9662"),
      anonymousFixture
        .replace("\u5468\u5973\u58eb", "\u8d75\u5973\u58eb")
        .replace("\u533f\u540d\u7814\u7a76\u9662", "\u8fdc\u822a\u7814\u7a76\u9662"),
    ].join("");
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installMaimaiCardButtons(document, writeText);
    const actions = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => button.textContent === "\u7acb\u5373\u6c9f\u901a");

    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action.previousElementSibling).toMatchObject({
        textContent: "\u52a0\u5165\u6279\u91cf",
      });
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
});
