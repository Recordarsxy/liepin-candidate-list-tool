type Gender = "" | "男" | "女";

export function normalizeMaskedName(name: string, gender: Gender): string {
  const trimmed = name.trim();
  const masked = trimmed.match(/^([\u3400-\u9fff])(?:\*|＊)+$/u);
  if (!masked || !gender) return trimmed;
  return `${masked[1]}${gender === "男" ? "先生" : "女士"}`;
}

export function normalizeAge(age: string): string {
  return age.trim().match(/^(\d{1,3})\s*岁?$/)?.[1] ?? "";
}

export function normalizeCityLevelLocation(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "";
  const first = trimmed.split(/\s*[-－—/\\]\s*/).find(Boolean) ?? "";
  if (/(?:自治区|省|区|县)$/.test(first) && !/市/.test(first)) return "";
  return first;
}
