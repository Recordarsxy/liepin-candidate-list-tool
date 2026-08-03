import { getLiepinPageState, type LiepinPausedReason } from "./page-state";

export type LiepinCareerEvidence = {
  company: string;
  role: string;
  education_level: "master" | "bachelor";
  school: string;
  source_field: "visible-detail";
};

export type LiepinCapture = {
  platform: "liepin";
  platform_candidate_id: string;
  source_page_type: "list" | "detail";
  name?: string;
  current_company?: string;
  current_role?: string;
  current_location?: string;
  master_school?: string;
  bachelor_school?: string;
  career_evidence: LiepinCareerEvidence[];
};

export type LiepinParseResult =
  | { status: "ready"; captures: LiepinCapture[] }
  | { status: "paused"; reason: LiepinPausedReason };

/** Parses only the caller-provided, user-triggered page DOM. */
export function parseLiepinDocument(document: Document): LiepinParseResult {
  const pageState = getLiepinPageState(document);
  if (pageState.status === "paused") {
    return pageState;
  }

  const detail = document.querySelector<HTMLElement>("[data-liepin-detail]");
  if (detail) {
    const capture = parseDetail(detail);
    return capture
      ? { status: "ready", captures: [capture] }
      : { status: "paused", reason: "dom_mismatch" };
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-liepin-list] [data-liepin-candidate-id]"));
  if (cards.length === 0) {
    return { status: "paused", reason: "dom_mismatch" };
  }
  const captures = cards.map(parseCard);
  if (captures.some((capture) => capture === null)) {
    return { status: "paused", reason: "dom_mismatch" };
  }
  return { status: "ready", captures: captures as LiepinCapture[] };
}

function parseCard(card: HTMLElement): LiepinCapture | null {
  const platformCandidateId = card.dataset.liepinCandidateId?.trim();
  if (!platformCandidateId) {
    return null;
  }
  return withoutEmptyFields({
    platform: "liepin",
    platform_candidate_id: platformCandidateId,
    source_page_type: "list",
    name: fieldText(card, "name"),
    current_company: fieldText(card, "current-company"),
    current_role: fieldText(card, "current-role"),
    current_location: fieldText(card, "current-location"),
    career_evidence: [],
  });
}

function parseDetail(detail: HTMLElement): LiepinCapture | null {
  const platformCandidateId = detail.dataset.liepinCandidateId?.trim();
  if (!platformCandidateId) {
    return null;
  }
  const company = fieldText(detail, "current-company");
  const role = fieldText(detail, "current-role");
  const schools = educationSchools(detail, company, role);
  return withoutEmptyFields({
    platform: "liepin",
    platform_candidate_id: platformCandidateId,
    source_page_type: "detail",
    name: fieldText(detail, "name"),
    current_company: company,
    current_role: role,
    master_school: schools.master_school,
    bachelor_school: schools.bachelor_school,
    career_evidence: schools.career_evidence,
  });
}

function educationSchools(
  detail: HTMLElement,
  company: string,
  role: string,
): Pick<LiepinCapture, "master_school" | "bachelor_school" | "career_evidence"> {
  const education = Array.from(detail.querySelectorAll<HTMLElement>("[data-education-level]"));
  const values = education.reduce<Record<string, string>>((result, section) => {
    const level = section.dataset.educationLevel;
    const school = fieldText(section, "school");
    if ((level === "master" || level === "bachelor") && school) {
      result[level] = school;
    }
    return result;
  }, {});
  const evidence = (Object.entries(values) as Array<["master" | "bachelor", string]>).map(
    ([education_level, school]) => ({
      company,
      role,
      education_level,
      school,
      source_field: "visible-detail" as const,
    }),
  );
  return {
    master_school: values.master,
    bachelor_school: values.bachelor,
    career_evidence: evidence,
  };
}

function fieldText(container: HTMLElement, name: string): string {
  return container.querySelector<HTMLElement>(`[data-field="${name}"]`)?.textContent?.trim() ?? "";
}

function withoutEmptyFields(capture: LiepinCapture): LiepinCapture {
  return Object.fromEntries(
    Object.entries(capture).filter(([, value]) => value !== ""),
  ) as LiepinCapture;
}
