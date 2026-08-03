import type { CandidateDraft } from "../contracts/candidate";
import { parseVisibleCard } from "../shared/card-fields";

const CARD_SELECTORS = [
  "table.new-resume-card",
  "[data-liepin-candidate-id]",
  ".tlog-common-resume-card",
];

export function findLiepinCards(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTORS.join(",")));
}

export function parseLiepinCard(card: HTMLElement): CandidateDraft | null {
  const id =
    card.dataset.liepinCandidateId?.trim() ||
    card.querySelector<HTMLInputElement>('input[type="checkbox"][value]')?.value.trim();
  return (
    parseLiveLiepinCard(card, id || undefined) ??
    parseVisibleCard(card, "liepin", id || undefined)
  );
}

type HistoryEntry = { parts: string[]; period: string };

function parseLiveLiepinCard(
  card: HTMLElement,
  id: string | undefined,
): CandidateDraft | null {
  const name = visibleText(card.querySelector(".new-resume-personal-name em"));
  const expected = expectedParts(card);
  const entries = historyEntries(card);
  const work = entries.find(
    (entry) =>
      !entry.parts.some((part) => ["本科", "硕士", "博士"].includes(part)),
  );
  const master = entries.find((entry) => entry.parts.includes("硕士"));
  const bachelor = entries.find((entry) => entry.parts.includes("本科"));
  if (!name || (!work?.parts[0] && !work?.parts[1] && !expected[1])) {
    return null;
  }
  return {
    platform: "liepin",
    ...(id ? { platform_candidate_id: id } : {}),
    source_page_type: "list",
    current_company: work?.parts[0] ?? "",
    name,
    gender: "",
    age: visibleText(card.querySelector(".personal-detail-age")),
    current_location: visibleText(card.querySelector(".personal-detail-dq")),
    preferred_location: expected[0] ?? "",
    current_role: work?.parts[1] ?? expected[1] ?? "",
    master_school: master?.parts[0] ?? "",
    bachelor_school: bachelor?.parts[0] ?? "",
    bachelor_start_year:
      bachelor?.period.match(/(?:19|20)\d{2}/)?.[0] ?? "",
  };
}

function expectedParts(card: HTMLElement): string[] {
  const container = card.querySelector(
    ".new-resume-personal-expect .personal-expect-content",
  );
  if (!container) return [];
  return Array.from(container.children).map(visibleText).filter(Boolean);
}

function historyEntries(card: HTMLElement): HistoryEntry[] {
  return Array.from(card.querySelectorAll("p"))
    .map((row) => {
      const texts = Array.from(row.children).map(visibleText).filter(Boolean);
      const content = texts.find((text) => text.includes(" · ")) ?? "";
      const period =
        texts.find((text) => /^(?:19|20)\d{2}[./-]\d{1,2}-/.test(text)) ?? "";
      return {
        parts: content.split(/\s*·\s*/).filter(Boolean),
        period,
      };
    })
    .filter((entry) => entry.parts.length >= 2);
}

function visibleText(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return "";
  if (
    element.hidden ||
    element.closest("[hidden]") ||
    element.style.display === "none"
  ) {
    return "";
  }
  return element.textContent?.trim() ?? "";
}
