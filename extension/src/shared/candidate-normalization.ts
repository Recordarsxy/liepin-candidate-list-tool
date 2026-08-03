type Gender = "" | "男" | "女";

const MUNICIPALITIES = ["北京", "上海", "天津", "重庆"] as const;
const PROVINCE_PREFIXES = [
  "内蒙古自治区",
  "广西壮族自治区",
  "西藏自治区",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "黑龙江",
  "陕西",
  "甘肃",
  "青海",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "台湾",
  "香港",
  "澳门",
] as const;

export function normalizeMaskedName(name: string, gender: Gender): string {
  const trimmed = name.trim();
  const masked = trimmed.match(/^([\u3400-\u9fff])(?:\*|＊|？)+$/u);
  if (!masked || !gender) return trimmed;
  return `${masked[1]}${gender === "男" ? "先生" : "女士"}`;
}

export function normalizeAge(age: string): string {
  return age.trim().match(/^(\d{1,3})(?:\s*岁)?$/)?.[1] ?? "";
}

export function normalizeCityLevelLocation(location: string): string {
  const first = location.trim().split(/\s*[-－—/\\]\s*/).find(Boolean) ?? "";
  if (!first) return "";

  const municipality = MUNICIPALITIES.find((city) => first.startsWith(city));
  if (municipality) return municipality;

  const province = PROVINCE_PREFIXES.find((prefix) => first.startsWith(prefix));
  const city = province ? first.slice(province.length).replace(/^省/, "") : first;
  if (!city || /(?:自治区|省|区|县)$/.test(city)) return "";
  return city.endsWith("市") ? city.slice(0, -1) : city;
}
