import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_ID, getModelInfo, MODEL_REGISTRY } from "./modelRegistry";

describe("MODEL_REGISTRY", () => {
  it("has a unique, non-empty id for every entry", () => {
    const ids = MODEL_REGISTRY.map((m) => m.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it("defaults to the first entry in the registry", () => {
    expect(DEFAULT_MODEL_ID).toBe(MODEL_REGISTRY[0].id);
  });
});

describe("getModelInfo", () => {
  it("returns the matching model by id", () => {
    const info = getModelInfo("efficientnetb0");
    expect(info.id).toBe("efficientnetb0");
    expect(info.preprocessing).toBe("efficientnet");
  });

  it("falls back to the first registry entry for an unknown id", () => {
    expect(getModelInfo("does-not-exist")).toEqual(MODEL_REGISTRY[0]);
    expect(getModelInfo("")).toEqual(MODEL_REGISTRY[0]);
  });
});
