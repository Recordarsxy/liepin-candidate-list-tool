import { describe, expect, it, vi } from "vitest";

import { mountSidePanel } from "./app";

describe("side-panel candidate pool", () => {
  it("renders and persists the capture toggle at the top of the panel", async () => {
    const root = document.createElement("main");
    const set = vi.fn().mockResolvedValue(undefined);
    await mountSidePanel(root, {
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      }),
      storage: {
        get: vi.fn().mockImplementation(async (key: string) =>
          key === "pairingToken"
            ? { pairingToken: "token-1" }
            : { collectorEnabled: true },
        ),
        set,
      },
      pair: vi.fn(),
    });

    const toggle = root.querySelector<HTMLButtonElement>(
      "[data-action='toggle-collector']",
    );
    expect(root.firstElementChild).toBe(toggle?.parentElement);
    expect(toggle?.textContent).toBe("采集已开启");
    toggle?.click();
    await vi.waitFor(() =>
      expect(set).toHaveBeenCalledWith({ collectorEnabled: false }),
    );
    expect(toggle?.textContent).toBe("采集已关闭");
  });

  it("renders pairing UI before a local token exists", async () => {
    const root = document.createElement("main");
    await mountSidePanel(root, {
      fetchImpl: vi.fn(),
      storage: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
      pair: vi.fn(),
    });

    expect(root.querySelector("[data-action='pair']")).not.toBeNull();
    expect(root.textContent).toContain("配对码");
  });

  it("shows the pairing error returned by the background", async () => {
    const root = document.createElement("main");
    await mountSidePanel(root, {
      fetchImpl: vi.fn(),
      storage: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
      pair: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
    });

    root.querySelector<HTMLButtonElement>("[data-action='pair']")?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("Failed to fetch"));
  });

  it("renders eleven fields, duplicate warning and batch sync", async () => {
    const root = document.createElement("main");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              candidate_id: 14,
              status: "pending",
              possible_duplicate_ids: [15],
              fields: {
                current_company: "Northwind Capital",
                name: "陈女士",
                source: "猎聘",
              },
            },
          ],
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });

    await mountSidePanel(root, {
      fetchImpl,
      storage: {
        get: vi.fn().mockResolvedValue({ pairingToken: "token-1" }),
        set: vi.fn().mockResolvedValue(undefined),
      },
      pair: vi.fn(),
    });

    expect(root.querySelectorAll("[data-candidate-field]")).toHaveLength(11);
    expect(root.textContent).toContain("疑似重复：#15");
    const checkbox = root.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (checkbox) checkbox.checked = true;
    root.querySelector<HTMLButtonElement>("[data-action='sync-selected']")?.click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });
});
