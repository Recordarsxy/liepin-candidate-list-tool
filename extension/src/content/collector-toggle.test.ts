import { describe, expect, it, vi } from "vitest";

import {
  installCollectorToggle,
  type StorageChangeListener,
} from "./collector-toggle";

describe("collector toggle controller", () => {
  it("defaults to enabled and follows local storage changes", async () => {
    const listeners = new Set<StorageChangeListener>();
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const install = vi
      .fn<() => () => void>()
      .mockReturnValueOnce(firstStop)
      .mockReturnValueOnce(secondStop);
    const dispose = await installCollectorToggle({
      storage: { get: vi.fn().mockResolvedValue({}) },
      changes: {
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
      },
      install,
    });

    expect(install).toHaveBeenCalledTimes(1);
    const listener = Array.from(listeners)[0];
    listener({ collectorEnabled: { newValue: false } }, "local");
    expect(firstStop).toHaveBeenCalledTimes(1);
    listener({ collectorEnabled: { newValue: true } }, "local");
    expect(install).toHaveBeenCalledTimes(2);

    dispose();
    expect(secondStop).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });
});
