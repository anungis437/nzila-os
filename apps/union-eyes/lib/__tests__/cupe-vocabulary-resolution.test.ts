import { describe, expect, it } from "vitest";

import { getCUPEVocabulary } from "@nzila/cupe-vocabulary";

describe("CUPE vocabulary workspace resolution", () => {
  it("loads the public package entry without prebuilt dist artifacts", () => {
    const vocabulary = getCUPEVocabulary();

    expect(vocabulary.version).toBe("0.1.0");
    expect(vocabulary.caseTypes).not.toHaveLength(0);
  });
});