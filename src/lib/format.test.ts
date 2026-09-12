import { describe, expect, it } from "vitest";
import { truncateImageName } from "./format";

describe("truncateImageName", () => {
  it("leaves short names untouched", () => {
    expect(truncateImageName("mole.jpg")).toBe("mole.jpg");
  });

  it("leaves names exactly at maxLength untouched", () => {
    const name = "a".repeat(40);
    expect(truncateImageName(name)).toBe(name);
  });

  it("truncates names longer than the default max length and appends dots", () => {
    const name = "a".repeat(50);
    const result = truncateImageName(name);
    expect(result).toBe(`${"a".repeat(40)}.....`);
  });

  it("respects a custom maxLength", () => {
    expect(truncateImageName("abcdefghij", 5)).toBe("abcde.....");
  });

  it("handles an empty string", () => {
    expect(truncateImageName("")).toBe("");
  });
});
