import { describe, expect, it } from "vitest";

import { UFS, ufValida } from "@/lib/ufs";

describe("UFS", () => {
  it("tem as 27 siglas, sem repetição", () => {
    expect(UFS).toHaveLength(27);
    expect(new Set(UFS).size).toBe(27);
  });

  it("valida as siglas em maiúsculas", () => {
    expect(ufValida("SP")).toBe(true);
    expect(ufValida("MG")).toBe(true);
    expect(ufValida("XX")).toBe(false);
    expect(ufValida("sp")).toBe(false);
    expect(ufValida("")).toBe(false);
  });
});
