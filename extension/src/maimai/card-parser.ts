import type { CandidateDraft } from "../contracts/candidate";
import {
  normalizeAge,
  normalizeCityLevelLocation,
  normalizeMaskedName,
} from "../shared/candidate-normalization";

const PERIOD = /(?:19|20)\d{2}[./-]\d{1,2}\s*[-—–]\s*(?:至今|(?:19|20)\d{2}[./-]\d{1,2})/;
const COMMUNICATION_TEXTS = new Set(["立即沟通", "沟通"]);
const EDUCATION_DEGREES = new Set(["大专", "本科", "硕士", "博士"]);
const EXPERIENCE = /^\d+\s*年$/;
const EXPECTATION = /^期望[：:]/;
const PROFILE_STATUS = /活跃|求职|机会|动向|招聘动态|关注行情|简历/;
const DISPLAY_NAME = /^[\u3400-\u9fff]{1,4}(?:[＊*？?]+)?$/u;
const EXPLICIT_DISPLAY_NAME = /(?:先生|女士|[＊*？?]+)$/u;
const COLLECTOR_UI =
  "[data-candidate-collector-button],[data-candidate-collector-batch]";

type HistoryRow = {
  period: string;
  organization: string;
  subject: string;
  degree: string;
};

export function findMaimaiCommunicationAction(card: HTMLElement): HTMLElement | null {
  if (
    isVisible(card) &&
    COMMUNICATION_TEXTS.has(visibleTextFromNodes(card))
  ) {
    return card;
  }
  return visibleCommunicationActions(card)[0] ?? null;
}

export function findMaimaiCards(root: ParentNode): HTMLElement[] {
  return visibleCommunicationActions(root);
}

export function parseMaimaiCard(card: HTMLElement): CandidateDraft | null {
  const candidate = findNamedCandidateRoot(card);
  const tokens = visibleLeafTexts(candidate);
  const ageIndex = tokens.findIndex((token) => normalizeAge(token) !== "");
  const expectationIndex = tokens.findIndex((token) => EXPECTATION.test(token));
  const name = findProfileName(tokens);
  const gender = findGender(candidate);
  const histories = findHistoryRows(candidate);
  const currentWork = histories.find((row) => !EDUCATION_DEGREES.has(row.degree));
  const master = histories.find((row) => row.degree === "硕士");
  const bachelor = histories.find((row) => row.degree === "本科");
  const currentLocation = findCurrentLocation(tokens, name, ageIndex, expectationIndex);
  const preferredLocation = expectationIndex === -1 ? "" : normalizeCityLevelLocation(tokens[expectationIndex + 1] ?? "");
  const currentRole = currentWork?.subject ?? "";

  if (!name) return null;

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

function findProfileName(tokens: string[]): string {
  const boundaryIndex = tokens.findIndex(isProfileBoundary);
  const candidates = tokens
    .slice(0, boundaryIndex === -1 ? undefined : boundaryIndex)
    .filter(
      (token) =>
        DISPLAY_NAME.test(token) &&
        !PROFILE_STATUS.test(token) &&
        !COMMUNICATION_TEXTS.has(token),
    );
  return candidates.find((token) => EXPLICIT_DISPLAY_NAME.test(token)) ?? candidates[0] ?? "";
}

function findNamedCandidateRoot(start: HTMLElement): HTMLElement {
  let best: HTMLElement | null = null;
  let bestScore = -1;

  for (let candidate: HTMLElement | null = start; candidate; candidate = candidate.parentElement) {
    if (candidate.matches("body,html")) break;
    if (
      candidate !== start &&
      visibleCommunicationActions(candidate).length > 1
    ) {
      break;
    }
    const tokens = visibleLeafTexts(candidate);
    if (!findProfileName(tokens)) continue;

    const score = candidateDetailScore(tokens);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (tokens.some((token) => PERIOD.test(token))) return candidate;
  }
  return best ?? start;
}

function candidateDetailScore(tokens: string[]): number {
  return tokens.reduce((score, token) => {
    if (PERIOD.test(token)) return score + 4;
    if (
      normalizeAge(token) !== "" ||
      EXPERIENCE.test(token) ||
      EDUCATION_DEGREES.has(token) ||
      EXPECTATION.test(token)
    ) {
      return score + 1;
    }
    return score;
  }, 0);
}

function isProfileBoundary(token: string): boolean {
  return (
    normalizeAge(token) !== "" ||
    EXPERIENCE.test(token) ||
    EDUCATION_DEGREES.has(token) ||
    EXPECTATION.test(token) ||
    PERIOD.test(token)
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

function findCurrentLocation(
  tokens: string[],
  name: string,
  ageIndex: number,
  expectationIndex: number,
): string {
  const timelineIndex = tokens.findIndex((token) => PERIOD.test(token));
  const summaryEnd = Math.min(
    expectationIndex === -1 ? tokens.length : expectationIndex,
    timelineIndex === -1 ? tokens.length : timelineIndex,
  );
  const educationIndex = tokens.findIndex(
    (token, index) => index < summaryEnd && EDUCATION_DEGREES.has(token),
  );
  if (educationIndex !== -1) {
    const location = findLocationIn(tokens.slice(educationIndex + 1, summaryEnd), name);
    if (location) return location;
  }
  if (ageIndex !== -1) {
    return findLocationIn(tokens.slice(ageIndex + 1, summaryEnd), name);
  }
  const nameIndex = tokens.indexOf(name);
  return nameIndex === -1
    ? ""
    : findLocationIn(tokens.slice(nameIndex + 1, summaryEnd), name);
}

function findLocationIn(tokens: string[], name: string): string {
  return (
    tokens
      .filter(
        (token) =>
          token !== name &&
          !PROFILE_STATUS.test(token) &&
          normalizeAge(token) === "" &&
          !EXPERIENCE.test(token) &&
          !EDUCATION_DEGREES.has(token) &&
          !EXPECTATION.test(token) &&
          !PERIOD.test(token) &&
          !COMMUNICATION_TEXTS.has(token),
      )
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
  const boundary = root instanceof Document ? root.documentElement : root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const actions: HTMLElement[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const label = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    if (
      !parent ||
      !COMMUNICATION_TEXTS.has(label) ||
      !isVisible(parent) ||
      visibleTextFromNodes(parent) !== label
    ) {
      continue;
    }

    let action = parent;
    while (
      action.parentElement &&
      action !== boundary &&
      action.parentElement !== boundary
    ) {
      if (hasIndependentVisibleSibling(action)) break;
      if (action.parentElement.matches("body,html")) break;
      if (visibleTextFromNodes(action.parentElement) !== label) {
        break;
      }
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
    if (
      element.children.length ||
      !isVisible(element) ||
      element.closest(COLLECTOR_UI)
    ) {
      return [];
    }
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
