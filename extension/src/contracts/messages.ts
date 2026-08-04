export const CAPTURE_MESSAGE = "candidate-collector/capture";
export const PAIR_MESSAGE = "candidate-collector/pair";

export function requireRuntimeStatus(response: unknown, expected: string): void {
  if (
    typeof response !== "object" ||
    response === null ||
    !("status" in response) ||
    response.status !== expected
  ) {
    const message =
      typeof response === "object" &&
      response !== null &&
      "error" in response &&
      typeof response.error === "string"
        ? response.error
        : "扩展后台请求失败";
    throw new Error(message);
  }
}
