import type { CandidateDraft } from "../contracts/candidate";

function sanitize(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

export function candidateToClipboardRow(draft: CandidateDraft): string {
  return [
    draft.current_company,
    draft.name,
    draft.gender,
    draft.age,
    draft.current_location,
    draft.preferred_location,
    draft.current_role,
    draft.master_school,
    draft.bachelor_school,
    draft.bachelor_start_year,
    draft.platform === "liepin" ? "猎聘" : "脉脉",
  ]
    .map(sanitize)
    .join("\t");
}
