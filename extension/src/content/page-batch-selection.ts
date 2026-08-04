import type { CandidateDraft } from "../contracts/candidate";
import { candidateToClipboardRow } from "../export/clipboard-row";

export class PageBatchSelection {
  private readonly rows = new Map<string, string>();

  get size(): number {
    return this.rows.size;
  }

  has(draft: CandidateDraft): boolean {
    return this.rows.has(keyFor(draft));
  }

  toggle(draft: CandidateDraft): boolean {
    const key = keyFor(draft);
    if (this.rows.has(key)) {
      this.rows.delete(key);
      return false;
    }
    this.rows.set(key, candidateToClipboardRow(draft));
    return true;
  }

  toClipboardText(): string {
    return Array.from(this.rows.values()).join("\n");
  }

  clear(): void {
    this.rows.clear();
  }
}

function keyFor(draft: CandidateDraft): string {
  return draft.platform_candidate_id
    ? `${draft.platform}:${draft.platform_candidate_id}`
    : `row:${candidateToClipboardRow(draft)}`;
}
