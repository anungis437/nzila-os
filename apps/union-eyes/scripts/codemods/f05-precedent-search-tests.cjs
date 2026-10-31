const fs = require('fs')
const f = 'lib/services/__tests__/precedent-service.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
s = s.replace(`    fullText: "fullText",
  },
  arbitratorProfiles: {`, `    fullText: "fullText",
    isPublic: "isPublic",
    accessRestrictions: "accessRestrictions",
  },
  arbitratorProfiles: {`)
s = s.replace(`import { db } from "@/db/db";
import {
  getPrecedentById,`, `import { db } from "@/db/db";
import { eq, like } from "drizzle-orm";
import {
  PrecedentFilterError,
  getPrecedentById,`)
const anchor = `  // ── getPrecedentsByIssueType ───────────────────────────────────────`
if (!s.includes(anchor)) throw new Error('anchor')
s = s.replace(anchor, `  // DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT, DEF-0B11-PRP-PRECEDENT-SEARCH-USES-UNESCAPED-WILDCARD-LIKE
  describe("what the library reads", () => {
    it("takes the wildcards of a search term literally", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([]));
      await searchPrecedents("50%_off");
      expect(like).toHaveBeenCalledWith("fullText", "%50\\\\%\\\\_off%");
    });

    it("restricts a search to decisions marked public with no access restriction", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([]));
      await searchPrecedents("discipline");
      expect(eq).toHaveBeenCalledWith("isPublic", true);
      expect(eq).toHaveBeenCalledWith("accessRestrictions", "");
    });

    it("applies the same restriction to a read by id", async () => {
      (db.query.arbitrationDecisions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      expect(await getPrecedentById("d1")).toBeNull();
      expect(eq).toHaveBeenCalledWith("isPublic", true);
    });

    it("refuses a filter value outside the column's declared values instead of casting it to the database", async () => {
      const columns = (await import("@/db/schema")).arbitrationDecisions as unknown as Record<string, unknown>;
      const original = columns.tribunal;
      columns.tribunal = { enumValues: ["OLRB", "CIRB"] };
      try {
        await expect(searchPrecedents("x", { tribunal: ["NOT-A-TRIBUNAL"] })).rejects.toBeInstanceOf(PrecedentFilterError);
        await expect(searchPrecedents("x", { tribunal: ["NOT-A-TRIBUNAL"] })).rejects.toMatchObject({ code: "INVALID_PRECEDENT_FILTER" });
      } finally {
        columns.tribunal = original;
      }
    });
  });

` + anchor)
fs.writeFileSync(f, s)
console.log('ok')
