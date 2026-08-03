import { describe, expect, it, vi } from "vitest";
import manifestSource from "../manifest.json?raw";

import { registerSidePanelAction } from "./background";

describe("background side-panel action", () => {
  it("opens the side panel in the clicked browser window", () => {
    let listener: ((tab: { windowId?: number }) => void) | undefined;
    const open = vi.fn().mockResolvedValue(undefined);

    registerSidePanelAction(
      { onClicked: { addListener: (next) => (listener = next) } },
      { open },
    );
    listener?.({ windowId: 42 });

    expect(open).toHaveBeenCalledWith({ windowId: 42 });
  });

  it("ignores tabs without a numeric window id", () => {
    let listener: ((tab: { windowId?: number }) => void) | undefined;
    const open = vi.fn().mockResolvedValue(undefined);

    registerSidePanelAction(
      { onClicked: { addListener: (next) => (listener = next) } },
      { open },
    );
    listener?.({});

    expect(open).not.toHaveBeenCalled();
  });

  it("uses only the required extension permissions", () => {
    const manifest = JSON.parse(manifestSource) as {
      permissions?: string[];
      host_permissions?: string[];
    };

    expect(manifest.permissions ?? []).toEqual(
      expect.arrayContaining(["sidePanel", "storage", "clipboardWrite"]),
    );
    expect(manifest.host_permissions ?? []).not.toContain("http://127.0.0.1:8765/*");
    for (const forbidden of ["cookies", "webRequest", "webRequestBlocking"]) {
      expect(manifest.permissions ?? []).not.toContain(forbidden);
    }
  });
});
