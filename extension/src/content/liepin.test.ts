import { describe, expect, it, vi } from "vitest";
import manifestSource from "../../manifest.json?raw";
import contentSource from "./liepin.ts?raw";

import { installLiepinCardButtons } from "./liepin";

describe("Liepin content script", () => {
  it("captures only the clicked visible card through runtime messaging", async () => {
    document.body.innerHTML = `
      <table class="new-resume-card" data-liepin-candidate-id="lp-1">
        <tbody><tr><td>
          <span data-field="name">陈女士</span>
          <span data-field="current-company">Northwind Capital</span>
          <span data-field="current-role">机构销售</span>
        </td></tr></tbody>
      </table>`;
    const sendMessage = vi.fn().mockResolvedValue({ status: "stored" });

    const dispose = installLiepinCardButtons(document, sendMessage);
    document.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    expect(sendMessage.mock.calls[0][0].capture.platform).toBe("liepin");
    dispose();
  });

  it("shows retry when the background reports a helper error", async () => {
    document.body.innerHTML = `
      <table class="new-resume-card" data-liepin-candidate-id="lp-1">
        <tbody><tr><td>
          <span data-field="name">陈女士</span>
          <span data-field="current-company">Northwind Capital</span>
          <span data-field="current-role">机构销售</span>
        </td></tr></tbody>
      </table>`;
    const sendMessage = vi.fn().mockResolvedValue({
      status: "error",
      error: "本地助手拒绝了请求",
    });

    const dispose = installLiepinCardButtons(document, sendMessage);
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
  });
});
