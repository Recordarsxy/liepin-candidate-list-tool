import { describe, expect, it, vi } from "vitest";

import type { CandidateDraft } from "./contracts/candidate";
import {
  CAPTURE_MESSAGE,
  HelperClient,
  PAIR_MESSAGE,
  registerBackgroundMessages,
  type RuntimeMessageListener,
} from "./background";

const draft: CandidateDraft = {
  platform: "liepin",
  platform_candidate_id: "lp-1",
  source_page_type: "list",
  current_company: "Northwind Capital",
  name: "陈女士",
  gender: "",
  age: "",
  current_location: "",
  preferred_location: "",
  current_role: "机构销售",
  master_school: "",
  bachelor_school: "",
  bachelor_start_year: "",
};

function runtimeHarness(): {
  runtime: { onMessage: { addListener: (listener: RuntimeMessageListener) => void } };
  listener: () => RuntimeMessageListener;
} {
  let installed: RuntimeMessageListener | undefined;
  return {
    runtime: { onMessage: { addListener: (listener) => (installed = listener) } },
    listener: () => installed as RuntimeMessageListener,
  };
}

describe("background helper client", () => {
  it("forwards a card capture with the stored pairing token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const storage = {
      get: vi.fn().mockResolvedValue({ pairingToken: "token-1" }),
      set: vi.fn(),
    };
    const client = new HelperClient(fetchImpl, storage);

    await client.capture(draft);

    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8765/v1/candidates/capture", {
      method: "POST",
      headers: { "content-type": "application/json", "x-candidate-token": "token-1" },
      body: JSON.stringify(draft),
    });
  });

  it("exchanges and stores a one-time pairing code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "token-2" }),
    });
    const storage = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };
    const client = new HelperClient(fetchImpl, storage);

    await client.pair("123456");

    expect(storage.set).toHaveBeenCalledWith({ pairingToken: "token-2" });
  });

  it("routes capture and pairing messages", async () => {
    const harness = runtimeHarness();
    const client = {
      capture: vi.fn().mockResolvedValue(undefined),
      pair: vi.fn().mockResolvedValue(undefined),
    };
    registerBackgroundMessages(harness.runtime, client);
    const captureResponse = vi.fn();
    const pairResponse = vi.fn();

    expect(
      harness.listener()(
        { type: CAPTURE_MESSAGE, capture: draft },
        {},
        captureResponse,
      ),
    ).toBe(true);
    expect(
      harness.listener()(
        { type: PAIR_MESSAGE, code: "123456" },
        {},
        pairResponse,
      ),
    ).toBe(true);

    expect(client.capture).toHaveBeenCalledWith(draft);
    expect(client.pair).toHaveBeenCalledWith("123456");
    await vi.waitFor(() =>
      expect(captureResponse).toHaveBeenCalledWith({ status: "stored" }),
    );
    expect(pairResponse).toHaveBeenCalledWith({ status: "paired" });
  });

  it("returns helper failures through the message response", async () => {
    const harness = runtimeHarness();
    const client = {
      capture: vi.fn().mockRejectedValue(new Error("本地助手拒绝了请求")),
      pair: vi.fn(),
    };
    const sendResponse = vi.fn();
    registerBackgroundMessages(harness.runtime, client);

    expect(
      harness.listener()(
        { type: CAPTURE_MESSAGE, capture: draft },
        {},
        sendResponse,
      ),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        status: "error",
        error: "本地助手拒绝了请求",
      }),
    );
  });
});
