import { describe, expect, it, vi } from "vitest";
import manifestSource from "../../manifest.json?raw";
import contentSource from "./liepin.ts?raw";

import { installLiepinCardButtons } from "./liepin";

describe("Liepin content script", () => {
  it("copies two selected cards as two eleven-cell rows", async () => {
    document.body.innerHTML = `
      <table class="new-resume-card" data-liepin-candidate-id="lp-1">
        <tbody><tr><td>
          <span data-field="name">陈女士</span>
          <span data-field="current-company">Northwind Capital</span>
          <span data-field="current-role">机构销售</span>
        </td></tr></tbody>
      </table>
      <table class="new-resume-card" data-liepin-candidate-id="lp-2">
        <tbody><tr><td>
          <span data-field="name">赵先生</span>
          <span data-field="current-company">Contoso Securities</span>
          <span data-field="current-role">销售总监</span>
        </td></tr></tbody>
      </table>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installLiepinCardButtons(document, writeText);
    document
      .querySelectorAll<HTMLButtonElement>("[data-candidate-collector-button]")
      .forEach((button) => button.click());
    expect(writeText).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const rows = writeText.mock.calls[0][0].split("\n");
    expect(rows).toHaveLength(2);
    expect(rows.every((row: string) => row.split("\t").length === 11)).toBe(true);
    expect(rows.every((row: string) => row.split("\t")[10] === "猎聘")).toBe(true);
    dispose();
  });

  it("shows retry when the clipboard write fails", async () => {
    document.body.innerHTML = `
      <table class="new-resume-card" data-liepin-candidate-id="lp-1">
        <tbody><tr><td>
          <span data-field="name">陈女士</span>
          <span data-field="current-company">Northwind Capital</span>
          <span data-field="current-role">机构销售</span>
        </td></tr></tbody>
      </table>`;
    const writeText = vi.fn().mockRejectedValue(new Error("剪贴板被浏览器拒绝"));

    const dispose = installLiepinCardButtons(document, writeText);
    document.querySelector<HTMLButtonElement>("[data-candidate-collector-button]")?.click();
    document.querySelector<HTMLButtonElement>("[data-action='copy-batch']")?.click();
    await vi.waitFor(() =>
      expect(
        document.querySelector("[data-action='copy-batch']")?.textContent,
      ).toBe("重试"),
    );
    dispose();
  });

  it("keeps manifest permissions free of cookies and request interception", () => {
    const manifest = JSON.parse(manifestSource) as { permissions?: string[] };
    expect(manifest.permissions ?? []).not.toContain("cookies");
    expect(manifest.permissions ?? []).not.toContain("webRequest");
  });

  it("does not import or execute the background service worker in page context", () => {
    expect(contentSource).not.toContain('../background');
    expect(contentSource).not.toContain("sendMessage");
    expect(contentSource).not.toContain("CAPTURE_MESSAGE");
  });
});
