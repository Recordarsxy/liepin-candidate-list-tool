export type LiepinPausedReason =
  | "login_required"
  | "captcha_required"
  | "access_restricted"
  | "dom_mismatch";

export type LiepinPageState =
  | { status: "ready" }
  | { status: "paused"; reason: LiepinPausedReason };

export function getLiepinPageState(document: Document): LiepinPageState {
  const visibleText = getVisibleText(document);

  if (firstVisibleElement(document, "[data-liepin-login]") || /请登录|登录后查看/.test(visibleText)) {
    return { status: "paused", reason: "login_required" };
  }
  if (firstVisibleElement(document, "[data-liepin-captcha]") || /验证码|安全验证/.test(visibleText)) {
    return { status: "paused", reason: "captcha_required" };
  }
  if (firstVisibleElement(document, "[data-liepin-access-restricted]") || /访问受限|无权访问/.test(visibleText)) {
    return { status: "paused", reason: "access_restricted" };
  }
  return { status: "ready" };
}

export function firstVisibleElement<T extends Element>(
  container: ParentNode,
  selector: string,
): T | undefined {
  return visibleElements<T>(container, selector)[0];
}

export function visibleElements<T extends Element>(container: ParentNode, selector: string): T[] {
  return Array.from(container.querySelectorAll<T>(selector)).filter(isVisibleElement);
}

export function isVisibleElement(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (
      current.tagName === "TEMPLATE" ||
      current.hasAttribute("hidden") ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = globalThis.getComputedStyle?.(current);
    if (style?.display === "none" || style?.visibility === "hidden") {
      return false;
    }
  }
  return true;
}

function getVisibleText(document: Document): string {
  const text: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && isVisibleElement(node.parentElement)) {
      text.push(node.textContent ?? "");
    }
  }
  return text.join(" ").replace(/\s+/g, " ").trim();
}
