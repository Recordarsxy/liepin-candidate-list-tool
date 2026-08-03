import { describe, expect, it, vi } from "vitest";
import manifestSource from "../../manifest.json?raw";
import contentSource from "./liepin.ts?raw";

import { installLiepinCardButtons } from "./liepin";

describe("Liepin content script", () => {
  it("copies only the clicked visible card as eleven cells", async () => {
    document.body.innerHTML = `
      <table class="new-resume-card" data-liepin-candidate-id="lp-1">
        <tbody><tr><td>
          <span data-field="name">陈女士</span>
          <span data-field="current-company">Northwind Capital</span>
          <span data-field="current-role">机构销售</span>
        </td></tr></tbody>
      </table>`;
    const writeText = vi.fn().mockResolvedValue(undefined);

    const dispose = installLiepinCardButtons(document, writeText);
    document.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const cells = writeText.mock.calls[0][0].split("\t");
    expect(cells).toHaveLength(11);
    expect(cells[1]).toBe("陈女士");
    expect(cells[10]).toBe("猎聘");
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
    document.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("button")?.textContent).toBe("重试"),
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
