import type { CandidateDraft } from "./contracts/candidate";
import { CAPTURE_MESSAGE, PAIR_MESSAGE } from "./contracts/messages";

export { CAPTURE_MESSAGE, PAIR_MESSAGE };
export const HELPER_URL = "http://127.0.0.1:8765";

type FetchResponse = { ok: boolean; json: () => Promise<unknown> };
type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;
type StorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};

export type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: { status: string; error?: string }) => void,
) => boolean | undefined;

type Runtime = {
  onMessage: { addListener: (listener: RuntimeMessageListener) => void };
};

type Client = {
  capture: (draft: CandidateDraft) => Promise<unknown>;
  pair: (code: string) => Promise<unknown>;
};

export class HelperClient {
  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly storage: StorageArea,
  ) {}

  async capture(draft: CandidateDraft): Promise<unknown> {
    return this.authorizedRequest("/v1/candidates/capture", draft);
  }

  async pair(code: string): Promise<void> {
    const response = await this.fetchImpl(`${HELPER_URL}/v1/pairing/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error("配对码无效或已经使用");
    const payload = (await response.json()) as { token?: unknown };
    if (typeof payload.token !== "string") throw new Error("本地助手返回了无效令牌");
    await this.storage.set({ pairingToken: payload.token });
  }

  private async authorizedRequest(path: string, payload: unknown): Promise<unknown> {
    const stored = await this.storage.get("pairingToken");
    const token = stored.pairingToken;
    if (typeof token !== "string" || !token) throw new Error("请先与本地助手配对");
    const response = await this.fetchImpl(`${HELPER_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-candidate-token": token,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("本地助手拒绝了请求");
    return response.json();
  }
}

export function registerBackgroundMessages(runtime: Runtime, client: Client): void {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRecord(message) || typeof message.type !== "string") return undefined;
    if (message.type === CAPTURE_MESSAGE && "capture" in message) {
      respondLater(
        client.capture(message.capture as CandidateDraft),
        "stored",
        sendResponse,
      );
      return true;
    }
    if (message.type === PAIR_MESSAGE && typeof message.code === "string") {
      respondLater(client.pair(message.code), "paired", sendResponse);
      return true;
    }
    return undefined;
  });
}

function respondLater(
  operation: Promise<unknown>,
  status: string,
  sendResponse: (response: { status: string; error?: string }) => void,
): void {
  void operation
    .then(() => sendResponse({ status }))
    .catch((error: unknown) =>
      sendResponse({
        status: "error",
        error: error instanceof Error ? error.message : "本地助手请求失败",
      }),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

declare const chrome:
  | {
      runtime: Runtime;
      storage: { local: StorageArea };
      action: {
        onClicked: {
          addListener: (listener: (tab: { windowId?: number }) => void) => void;
        };
      };
      sidePanel: { open: (options: { windowId: number }) => Promise<void> };
    }
  | undefined;

if (typeof chrome !== "undefined") {
  const client = new HelperClient(globalThis.fetch, chrome.storage.local);
  registerBackgroundMessages(chrome.runtime, client);
  chrome.action.onClicked.addListener((tab) => {
    if (typeof tab.windowId === "number") void chrome.sidePanel.open({ windowId: tab.windowId });
  });
}
