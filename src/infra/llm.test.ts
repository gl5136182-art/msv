import { describe, expect, it } from "vitest";

import { lerJson } from "./llm";

describe("lerJson", () => {
  it("lê JSON puro", () => {
    expect(lerJson('{"ok":true}')).toEqual({ ok: true });
  });

  it("lê JSON embrulhado em bloco de código", () => {
    expect(lerJson('```json\n{"linhas":[]}\n```')).toEqual({ linhas: [] });
  });

  it("falha quando não há JSON", () => {
    expect(() => lerJson("sem json")).toThrow();
  });
});
