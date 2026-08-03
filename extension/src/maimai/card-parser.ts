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
  const gender = findGender(candidate, name);
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
  }
  return best ?? start;
}

function candidateDetailScore(tokens: string[]): number {
  return findPeriodSpans(tokens).length * 4 + tokens.reduce((score, token) => {
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
    normalizeEducationDegree(token) !== "" ||
    EXPECTATION.test(token) ||
    PERIOD.test(token)
  );
}

function findGender(card: HTMLElement, name: string): "" | "男" | "女" {
  if (name.endsWith("女士")) return "女";
  if (name.endsWith("先生")) return "男";

  const nameElement = Array.from(card.querySelectorAll<HTMLElement>("*"))
    .find((element) => isVisible(element) && visibleText(element) === name);
  const region = nameElement ? findAvatarRegionBeforeName(card, nameElement) : null;
  if (!region) return "";
  const coloredElements = [
    ...(region.matches("svg,svg *") ? [region] : []),
    ...Array.from(region.querySelectorAll("svg,svg *")),
  ].filter((element) => isVisible(element));

  for (const element of coloredElements) {
    const styles = element.ownerDocument.defaultView?.getComputedStyle(element);
    const colors = [
      element.getAttribute("fill"),
      element.getAttribute("stroke"),
      styles?.fill,
      styles?.stroke,
      styles?.color,
      styles?.backgroundColor,
    ];
    for (const color of colors) {
      const gender = genderFromColor(color ?? "");
      if (gender) return gender;
    }
  }
  return "";
}

function findAvatarRegionBeforeName(
  card: HTMLElement,
  nameElement: HTMLElement,
): Element | null {
  for (
    let anchor: Element | null = nameElement;
    anchor && anchor !== card;
    anchor = anchor.parentElement
  ) {
    const previous = anchor.previousElementSibling;
    if (!previous) continue;
    if (isIndependentControl(previous)) return null;
    if (
      previous.matches("img,svg") ||
      previous.querySelector("img,svg")
    ) {
      return previous;
    }
  }
  return null;
}

function genderFromColor(color: string): "" | "男" | "女" {
  const normalized = color.trim().toLowerCase();
  if (!normalized || normalized === "none" || normalized === "transparent") return "";

  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  const rgb = normalized.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i,
  );
  let red: number;
  let green: number;
  let blue: number;
  if (hex) {
    const expanded = hex.length === 3
      ? hex.split("").map((digit) => digit + digit).join("")
      : hex.slice(0, 6);
    red = Number.parseInt(expanded.slice(0, 2), 16);
    green = Number.parseInt(expanded.slice(2, 4), 16);
    blue = Number.parseInt(expanded.slice(4, 6), 16);
  } else if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return "";
    red = Number(rgb[1]);
    green = Number(rgb[2]);
    blue = Number(rgb[3]);
  } else {
    return "";
  }

  if (red >= 140 && red > green * 1.25 && red > blue * 1.25) return "女";
  if (blue >= 100 && blue > red * 1.25 && blue > green * 1.1) return "男";
  return "";
}

function findCurrentLocation(
  tokens: string[],
  name: string,
  ageIndex: number,
  expectationIndex: number,
): string {
  const timelineIndex = findPeriodSpans(tokens)[0]?.start ?? -1;
  const summaryEnd = Math.min(
    expectationIndex === -1 ? tokens.length : expectationIndex,
    timelineIndex === -1 ? tokens.length : timelineIndex,
  );
  const educationIndex = tokens.findIndex(
    (token, index) =>
      index < summaryEnd && normalizeEducationDegree(token) !== "",
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
          normalizeEducationDegree(token) === "" &&
          !EXPECTATION.test(token) &&
          !PERIOD.test(token) &&
          !COMMUNICATION_TEXTS.has(token),
      )
      .map(normalizeCityLevelLocation)
      .find(Boolean) ?? ""
  );
}

function findHistoryRows(card: HTMLElement): HistoryRow[] {
  const candidates = Array.from(card.querySelectorAll<HTMLElement>("*"))
    .map((element) => {
      const tokens = visibleLeafTexts(element);
      const periods = findPeriodSpans(tokens);
      if (periods.length !== 1) return null;
      const fields = tokens.slice(periods[0].end + 1);
      if (!fields.length) return null;
      const degreeField = fields.find(
        (field) => normalizeEducationDegree(field) !== "",
      );
      const degree = degreeField ? normalizeEducationDegree(degreeField) : "";
      const [organization = "", subject = ""] = fields.filter(
        (field) => field !== degreeField && !isHistoryNoise(field),
      );
      return {
        element,
        row: { period: periods[0].period, organization, subject, degree },
        score:
          (degree ? 3 : 0) +
          (organization ? 1 : 0) +
          (subject ? 1 : 0),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is { element: HTMLElement; row: HistoryRow; score: number } =>
        Boolean(candidate),
    );

  return candidates
    .filter(
      (candidate) =>
        !candidates.some(
          (other) =>
            other !== candidate &&
            other.row.period === candidate.row.period &&
            (candidate.element.contains(other.element) ||
              other.element.contains(candidate.element)) &&
            (other.score > candidate.score ||
              (other.score === candidate.score &&
                candidate.element.contains(other.element))),
        ),
    )
    .map((candidate) => candidate.row);
}

function normalizeEducationDegree(field: string): string {
  const value = field.trim();
  if (/博士|ph\.?d/i.test(value)) return "博士";
  if (/硕士|研究生|mba|emba|mpa|mpacc/i.test(value)) return "硕士";
  if (/本科|学士/.test(value)) return "本科";
  if (/大专|专科/.test(value)) return "大专";
  return "";
}

function isHistoryNoise(field: string): boolean {
  const value = field.trim();
  return (
    !value ||
    /^[-—–·•|｜]+$/.test(value) ||
    COMMUNICATION_TEXTS.has(value) ||
    value === "更多"
  );
}

function findPeriodSpans(tokens: string[]): Array<{
  period: string;
  start: number;
  end: number;
}> {
  const spans: Array<{ period: string; start: number; end: number }> = [];
  const exactPeriod = new RegExp(`^(?:${PERIOD.source})$`);

  for (let start = 0; start < tokens.length; start += 1) {
    for (let end = start; end < Math.min(tokens.length, start + 3); end += 1) {
      const combined = tokens.slice(start, end + 1).join(" ").trim();
      if (!exactPeriod.test(combined)) continue;
      spans.push({ period: combined, start, end });
      start = end;
      break;
    }
  }
  return spans;
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
