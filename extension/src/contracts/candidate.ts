export type CandidatePlatform = "liepin" | "maimai";

export type CandidateDraft = {
  platform: CandidatePlatform;
  platform_candidate_id?: string;
  source_page_type: "list";
  current_company: string;
  name: string;
  gender: "" | "男" | "女";
  age: string;
  current_location: string;
  preferred_location: string;
  current_role: string;
  master_school: string;
  bachelor_school: string;
  bachelor_start_year: string;
};
