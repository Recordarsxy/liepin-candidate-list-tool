import { describe, expect, it, vi } from "vitest";

import { mountSidePanel } from "./app";

describe("clipboard side panel", () => {
  it("renders instructions and persists the collector toggle", async () => {
    const root = document.createElement("main");
    const set = vi.fn().mockResolvedValue(undefined);

    await mountSidePanel(root, {
      storage: {
        get: vi.fn().mockResolvedValue({ collectorEnabled: true }),
        set,
      },
    });

    const toggle = root.querySelector<HTMLButtonElement>(
      "[data-action='toggle-collector']",
    )!;
    expect(root.firstElementChild).toBe(toggle.parentElement);
    expect(toggle.textContent).toBe("采集已开启");
    expect(root.textContent).toContain("点击猎聘或脉脉卡片上的“复制候选人”");

    toggle.click();
    await vi.waitFor(() =>
      expect(set).toHaveBeenCalledWith({ collectorEnabled: false }),
    );
    expect(toggle.textContent).toBe("采集已关闭");
  });

  it("contains no pairing, candidate-pool, or sync controls", async () => {
    const root = document.createElement("main");

    await mountSidePanel(root, {
      storage: {
        get: vi.fn().mockResolvedValue({ collectorEnabled: true }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    });

    expect(root.querySelector("[data-action='pair']")).toBeNull();
    expect(root.querySelector("[data-action='sync-selected']")).toBeNull();
    expect(root.querySelector("[data-candidate-field]")).toBeNull();
  });
});
