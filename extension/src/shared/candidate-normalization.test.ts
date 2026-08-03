import { describe, expect, it } from "vitest";

import {
  normalizeAge,
  normalizeCityLevelLocation,
  normalizeMaskedName,
} from "./candidate-normalization";

describe("normalizeMaskedName", () => {
  it.each([
    ["张**", "男", "张先生"],
    ["李＊", "女", "李女士"],
    ["张**", "", "张**"],
    ["王小明", "男", "王小明"],
    ["赵先生", "男", "赵先生"],
    ["欧阳**", "男", "欧阳**"],
  ] as const)("normalizes %s with %s", (name, gender, expected) => {
    expect(normalizeMaskedName(name, gender)).toBe(expected);
  });
});

describe("normalizeAge", () => {
  it.each([
    ["31岁", "31"],
    ["31", "31"],
    [" 31 岁 ", "31"],
    ["30-35岁", ""],
    ["1993年出生", ""],
    ["", ""],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeAge(value)).toBe(expected);
  });
});

describe("normalizeCityLevelLocation", () => {
  it.each([
    ["上海-浦东新区", "上海"],
    ["杭州/余杭区", "杭州"],
    ["深圳—南山区", "深圳"],
    ["北京海淀区", "北京"],
    ["陕西西安", "西安"],
    ["福建福州", "福州"],
    ["呼和浩特", "呼和浩特"],
    ["浦东新区", ""],
    ["广东省", ""],
    ["", ""],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeCityLevelLocation(value)).toBe(expected);
  });
});
