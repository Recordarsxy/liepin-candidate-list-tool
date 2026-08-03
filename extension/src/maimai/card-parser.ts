import type { CandidateDraft } from "../contracts/candidate";
import {
  normalizeAge,
  normalizeCityLevelLocation,
  normalizeMaskedName,
} from "../shared/candidate-normalization";

const PERIOD = /(?:19|20)\d{2}[./-]\d{1,2}\s*[-—–]\s*(?:至今|(?:19|20)\d{2}[./-]\d{1,2})/;
const COMMUNICATION_TEXTS = new Set(["立即沟通", "沟通"]);
const EDUCATION_DEGREES = new Set(["硕士", "本科"]);
const ACTIVITY_LABELS = new Set(["近一周活跃", "本科", "硕士"]);

type HistoryRow = {
  period: string;
  organization: string;
  subject: string;
  degree: string;
};

export function findMaimaiCommunicationAction(card: HTMLElement): HTMLElement | null {
  return visibleCommunicationActions(card)[0] ?? null;
}

export function findMaimaiCards(root: ParentNode): HTMLElement[] {
  const cards: HTMLElement[] = [];
  for (const action of visibleCommunicationActions(root)) {
    let candidate = action.parentElement;
    while (candidate && candidate !== root) {
      const text = visibleLeafTexts(candidate).join(" ");
      const actionCount = visibleCommunicationActions(candidate).length;
      if (actionCount === 1 && /\d{1,3}\s*岁/.test(text) && /期望[：:]/.test(text)) {
        if (!cards.includes(candidate)) cards.push(candidate);
        break;
      }
      candidate = candidate.parentElement;
    }
  }
  return cards;
}

export function parseMaimaiCard(card: HTMLElement): CandidateDraft | null {
  const tokens = visibleLeafTexts(card);
  const ageIndex = tokens.findIndex((token) => normalizeAge(token) !== "");
  const expectationIndex = tokens.findIndex((token) => /^期望[：:]/.test(token));
  const name = findNameBeforeAge(tokens, ageIndex);
  const gender = findGender(card);
  const histories = findHistoryRows(card);
  const currentWork = histories.find((row) => !EDUCATION_DEGREES.has(row.degree));
  const master = histories.find((row) => row.degree === "硕士");
  const bachelor = histories.find((row) => row.degree === "本科");
  const currentLocation = findCurrentLocation(tokens, ageIndex, expectationIndex);
  const preferredLocation = expectationIndex === -1 ? "" : normalizeCityLevelLocation(tokens[expectationIndex + 1] ?? "");
  const currentRole = currentWork?.subject ?? "";

  if (!name || (!currentWork?.organization && !currentRole)) return null;

  return {
    platform: "maimai",
    source_page_type: "list",
    current_company: currentWork?.organization ?? "",
    name: normalizeMaskedName(name, gender),
    gender,
    age: ageIndex === -1 ? "" : normalizeAge(tokens[ageIndex]),
    current_location: currentLocation,
    preferred_location: preferredLocation,
    current_role: currentRole,
    master_school: master?.organization ?? "",
    bachelor_school: bachelor?.organization ?? "",
    bachelor_start_year: bachelor?.period.match(/(?:19|20)\d{2}/)?.[0] ?? "",
  };
}

function findNameBeforeAge(tokens: string[], ageIndex: number): string {
  if (ageIndex === -1) return "";
  return (
    tokens
      .slice(0, ageIndex)
      .filter(
        (token) =>
          !ACTIVITY_LABELS.has(token) && /^[\u3400-\u9fff]{1,4}(?:[＊*？]+)?$/u.test(token),
      )
      .at(-1) ?? ""
  );
}

function findGender(card: HTMLElement): "" | "男" | "女" {
  const fills = Array.from(card.querySelectorAll<SVGElement>("svg [fill]"))
    .filter(isVisible)
    .map((element) => element.getAttribute("fill"));
  if (fills.includes("#FF5833")) return "女";
  if (fills.includes("#085DFF")) return "男";
  return "";
}

function findCurrentLocation(tokens: string[], ageIndex: number, expectationIndex: number): string {
  const summary = tokens.slice(ageIndex + 1, expectationIndex === -1 ? undefined : expectationIndex);
  return (
    summary
      .filter((token) => !/^\d+年$/.test(token) && !EDUCATION_DEGREES.has(token))
      .map(normalizeCityLevelLocation)
      .find(Boolean) ?? ""
  );
}

function findHistoryRows(card: HTMLElement): HistoryRow[] {
  return Array.from(card.querySelectorAll<HTMLElement>("div"))
    .map((element) => visibleLeafTexts(element))
    .filter((tokens) => tokens.filter((token) => PERIOD.test(token)).length === 1)
    .map((tokens) => {
      const periodIndex = tokens.findIndex((token) => PERIOD.test(token));
      const fields = tokens.slice(periodIndex + 1);
      const degree = fields.find((field) => EDUCATION_DEGREES.has(field)) ?? "";
      const [organization = "", subject = ""] = fields.filter((field) => field !== degree);
      return { period: tokens[periodIndex], organization, subject, degree };
    });
}

function visibleCommunicationActions(root: ParentNode): HTMLElement[] {
  const document = root instanceof Document ? root : root.ownerDocument;
  if (!document) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const actions: HTMLElement[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const label = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    if (!parent || !COMMUNICATION_TEXTS.has(label) || !isVisible(parent)) continue;

    let action = parent;
    while (
      action.parentElement &&
      action.parentElement !== root &&
      visibleTextFromNodes(action.parentElement) === label &&
      !hasIndependentVisibleSibling(action)
    ) {
      action = action.parentElement;
    }
    if (!actions.includes(action)) actions.push(action);
  }

  return actions;
}

function visibleTextFromNodes(element: HTMLElement): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? "";
    if (text && node.parentElement && isVisible(node.parentElement)) texts.push(text);
  }

  return texts.join(" ");
}

function hasIndependentVisibleSibling(element: HTMLElement): boolean {
  return Array.from(element.parentElement?.children ?? []).some(
    (sibling) =>
      sibling !== element &&
      isVisible(sibling) &&
      sibling.getAttribute("aria-hidden")?.toLowerCase() !== "true" &&
      isIndependentControl(sibling),
  );
}

function isIndependentControl(element: Element): boolean {
  if (
    element.matches(
      "button,a,input,select,textarea,[role='button'],[role='link']",
    ) ||
    Boolean(element.getAttribute("aria-label")?.trim())
  ) {
    return true;
  }

  const tabindex = element.getAttribute("tabindex");
  return tabindex !== null && Number(tabindex) >= 0;
}

function visibleLeafTexts(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).flatMap((element) => {
    if (element.children.length || !isVisible(element)) return [];
    const text = visibleText(element);
    return text ? [text] : [];
  });
}

function visibleText(element: Element): string {
  return element.textContent?.trim() ?? "";
}

function isVisible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const styles = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      current.hasAttribute("hidden") ||
      styles?.display === "none" ||
      styles?.visibility === "hidden" ||
      styles?.visibility === "collapse"
    ) {
      return false;
    }
  }
  return true;
}
