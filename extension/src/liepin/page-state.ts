export type LiepinPausedReason =
  | "login_required"
  | "captcha_required"
  | "access_restricted"
  | "dom_mismatch";

export type LiepinPageState =
  | { status: "ready" }
  | { status: "paused"; reason: LiepinPausedReason };

export function getLiepinPageState(document: Document): LiepinPageState {
  const visibleText = document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  if (document.querySelector("[data-liepin-login]") || /请登录|登录后查看/.test(visibleText)) {
    return { status: "paused", reason: "login_required" };
  }
  if (document.querySelector("[data-liepin-captcha]") || /验证码|安全验证/.test(visibleText)) {
    return { status: "paused", reason: "captcha_required" };
  }
  if (document.querySelector("[data-liepin-access-restricted]") || /访问受限|无权访问/.test(visibleText)) {
    return { status: "paused", reason: "access_restricted" };
  }
  return { status: "ready" };
}
