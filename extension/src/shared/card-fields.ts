import type { CandidateDraft, CandidatePlatform } from "../contracts/candidate";
import {
  normalizeAge,
  normalizeCityLevelLocation,
  normalizeMaskedName,
} from "./candidate-normalization";

export type CardFieldSelectors = Record<
  | "name"
  | "gender"
  | "age"
  | "current_company"
  | "current_location"
  | "preferred_location"
  | "current_role"
  | "master_school"
  | "bachelor_school"
  | "bachelor_period",
  string[]
>;

export const DEFAULT_FIELD_SELECTORS: CardFieldSelectors = {
  name: ['[data-field="name"]', ".resume-name", '[class*="candidate-name"]'],
  gender: ['[data-field="gender"]', '[class*="gender"]'],
  age: ['[data-field="age"]', '[class*="age"]'],
  current_company: [
    '[data-field="current-company"]',
    ".current-company",
    '[class*="company-name"]',
  ],
  current_location: [
    '[data-field="current-location"]',
    ".current-location",
    '[class*="location"]',
  ],
  preferred_location: [
    '[data-field="preferred-location"]',
    ".preferred-location",
    '[class*="expect-location"]',
  ],
  current_role: [
    '[data-field="current-role"]',
    ".current-role",
    '[class*="job-title"]',
  ],
  master_school: ['[data-field="master-school"]', '[data-education-level="master"]'],
  bachelor_school: [
    '[data-field="bachelor-school"]',
    '[data-education-level="bachelor"]',
  ],
  bachelor_period: [
    '[data-field="bachelor-start-year"]',
    '[data-field="bachelor-period"]',
    '[data-education-period="bachelor"]',
  ],
};

export function parseVisibleCard(
  card: HTMLElement,
  platform: CandidatePlatform,
  platformCandidateId: string | undefined,
  selectors: CardFieldSelectors = DEFAULT_FIELD_SELECTORS,
): CandidateDraft | null {
  const name = firstVisibleText(card, selectors.name);
  const currentCompany = firstVisibleText(card, selectors.current_company);
  const currentRole = firstVisibleText(card, selectors.current_role);
  if (!name || (!currentCompany && !currentRole)) {
    return null;
  }
  const gender = firstVisibleText(card, selectors.gender);
  const normalizedGender = gender === "男" || gender === "女" ? gender : "";
  const bachelorPeriod = firstVisibleText(card, selectors.bachelor_period);
  return {
    platform,
    ...(platformCandidateId ? { platform_candidate_id: platformCandidateId } : {}),
    source_page_type: "list",
    current_company: currentCompany,
    name: normalizeMaskedName(name, normalizedGender),
    gender: normalizedGender,
    age: normalizeAge(firstVisibleText(card, selectors.age)),
    current_location: normalizeCityLevelLocation(
      firstVisibleText(card, selectors.current_location),
    ),
    preferred_location: normalizeCityLevelLocation(
      firstVisibleText(card, selectors.preferred_location),
    ),
    current_role: currentRole,
    master_school: firstVisibleText(card, selectors.master_school),
    bachelor_school: firstVisibleText(card, selectors.bachelor_school),
    bachelor_start_year: bachelorPeriod.match(/(?:19|20)\d{2}/)?.[0] ?? "",
  };
}

export function firstVisibleText(container: HTMLElement, selectors: string[]): string {
  for (const selector of selectors) {
    for (const element of container.querySelectorAll<HTMLElement>(selector)) {
      if (isVisible(element)) {
        const text = element.textContent?.trim() ?? "";
        if (text) return text;
      }
    }
  }
  return "";
}

function isVisible(element: HTMLElement): boolean {
  return !element.hidden && !element.closest("[hidden]") && element.style.display !== "none";
}
