import { describe, expect, it } from "vitest";
import { assessSymptoms } from "./symptomRisk";

describe("assessSymptoms", () => {
  it("returns not-flagged for null/undefined/empty notes", () => {
    expect(assessSymptoms(null)).toEqual({ flagged: false, matchedKeywords: [] });
    expect(assessSymptoms(undefined)).toEqual({ flagged: false, matchedKeywords: [] });
    expect(assessSymptoms("")).toEqual({ flagged: false, matchedKeywords: [] });
  });

  it("returns not-flagged when no keywords match", () => {
    const result = assessSymptoms("Just a normal freckle, nothing unusual.");
    expect(result.flagged).toBe(false);
    expect(result.matchedKeywords).toEqual([]);
  });

  it("flags and reports a single matched keyword", () => {
    const result = assessSymptoms("It has started bleeding a little.");
    expect(result.flagged).toBe(true);
    expect(result.matchedKeywords).toEqual(["bleed", "bleeding"]);
  });

  it("is case-insensitive", () => {
    const result = assessSymptoms("It is ITCHY and Growing.");
    expect(result.flagged).toBe(true);
    expect(result.matchedKeywords).toEqual(expect.arrayContaining(["itch", "itchy", "grow", "growing"]));
  });

  it("de-duplicates repeated keyword matches", () => {
    const result = assessSymptoms("changed, changed, and changed again");
    expect(result.matchedKeywords.filter((k) => k === "change").length).toBe(1);
  });

  it("matches multiple distinct keywords", () => {
    const result = assessSymptoms("The mole is asymmetric with irregular borders and has grown.");
    expect(result.flagged).toBe(true);
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(["asymmetric", "irregular", "border", "grow", "grown"])
    );
  });
});
