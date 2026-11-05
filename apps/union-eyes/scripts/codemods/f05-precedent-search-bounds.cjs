const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/services/precedent-service.ts', [
  [`type TribunalFilter = ArbitrationDecision['tribunal'];`, `// arbitration_decisions is shared across organizations and has no organization column, so what a row permits is on the row:
// a decision marked not public, or carrying an access restriction, is never read through this library.
function sharedDecisions(): SQL {
  return and(
    eq(arbitrationDecisions.isPublic, true),
    or(sql\`\${arbitrationDecisions.accessRestrictions} is null\`, eq(arbitrationDecisions.accessRestrictions, '')),
  ) as SQL;
}

/** The text of a search term with the LIKE wildcards taken literally, so a broad pattern cannot scan the whole text column. */
function containing(term: string): string {
  return \`%\${term.replace(/[\\\\%_]/g, '\\\\$&')}%\`;
}

export class PrecedentFilterError extends Error {
  readonly code = 'INVALID_PRECEDENT_FILTER';
}

/** A filter value that is not one of the column's declared values is refused, never cast through to the database. */
function checkedValues<T extends string>(values: string[] | undefined, allowed: readonly string[] | undefined, name: string): T[] | undefined {
  if (!values || values.length === 0) return undefined;
  if (allowed) {
    const rejected = values.find((value) => !allowed.includes(value));
    if (rejected !== undefined) throw new PrecedentFilterError(\`Invalid \${name} filter value\`);
  }
  return values as T[];
}

type TribunalFilter = ArbitrationDecision['tribunal'];`],
  [`    const decision = await db.query.arbitrationDecisions.findFirst({
      where: eq(arbitrationDecisions.id, id),
    });

    if (!decision) return null;`, `    const decision = await db.query.arbitrationDecisions.findFirst({
      where: and(eq(arbitrationDecisions.id, id), sharedDecisions()),
    });

    if (!decision) return null;`],
  [`    const decision = await db.query.arbitrationDecisions.findFirst({
      where: eq(arbitrationDecisions.caseNumber, caseNumber),
    });`, `    const decision = await db.query.arbitrationDecisions.findFirst({
      where: and(eq(arbitrationDecisions.caseNumber, caseNumber), sharedDecisions()),
    });`],
  // listPrecedents
  [`    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    if (filters.tribunal && filters.tribunal.length > 0) {
      conditions.push(inArray(arbitrationDecisions.tribunal, filters.tribunal as TribunalFilter[]));
    }

    if (filters.decisionType && filters.decisionType.length > 0) {
      conditions.push(
        inArray(arbitrationDecisions.decisionType, filters.decisionType as DecisionTypeFilter[])
      );
    }

    if (filters.outcome && filters.outcome.length > 0) {
      conditions.push(inArray(arbitrationDecisions.outcome, filters.outcome as OutcomeFilter[]));
    }

    if (filters.precedentValue && filters.precedentValue.length > 0) {
      conditions.push(
        inArray(
          arbitrationDecisions.precedentValue,
          filters.precedentValue as PrecedentValueFilter[]
        )
      );
    }

    if (filters.arbitrator) {
      conditions.push(like(arbitrationDecisions.arbitrator, \`%\${filters.arbitrator}%\`));
    }

    if (filters.union) {
      conditions.push(like(arbitrationDecisions.union, \`%\${filters.union}%\`));
    }

    if (filters.employer) {
      conditions.push(like(arbitrationDecisions.employer, \`%\${filters.employer}%\`));
    }`, `    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [sharedDecisions()];

    const tribunals = checkedValues<TribunalFilter>(filters.tribunal, arbitrationDecisions.tribunal?.enumValues, 'tribunal');
    if (tribunals) conditions.push(inArray(arbitrationDecisions.tribunal, tribunals));

    const decisionTypes = checkedValues<DecisionTypeFilter>(filters.decisionType, arbitrationDecisions.decisionType?.enumValues, 'decisionType');
    if (decisionTypes) conditions.push(inArray(arbitrationDecisions.decisionType, decisionTypes));

    const outcomes = checkedValues<OutcomeFilter>(filters.outcome, arbitrationDecisions.outcome?.enumValues, 'outcome');
    if (outcomes) conditions.push(inArray(arbitrationDecisions.outcome, outcomes));

    const precedentValues = checkedValues<PrecedentValueFilter>(filters.precedentValue, arbitrationDecisions.precedentValue?.enumValues, 'precedentValue');
    if (precedentValues) conditions.push(inArray(arbitrationDecisions.precedentValue, precedentValues));

    if (filters.arbitrator) {
      conditions.push(like(arbitrationDecisions.arbitrator, containing(filters.arbitrator)));
    }

    if (filters.union) {
      conditions.push(like(arbitrationDecisions.union, containing(filters.union)));
    }

    if (filters.employer) {
      conditions.push(like(arbitrationDecisions.employer, containing(filters.employer)));
    }`],
  [`      conditions.push(like(arbitrationDecisions.sector, \`%\${filters.sector}%\`));`, `      conditions.push(like(arbitrationDecisions.sector, containing(filters.sector)));`],
  [`          like(arbitrationDecisions.caseTitle, \`%\${filters.searchQuery}%\`),
          like(arbitrationDecisions.caseNumber, \`%\${filters.searchQuery}%\`),
          like(arbitrationDecisions.summary, \`%\${filters.searchQuery}%\`),
          like(arbitrationDecisions.headnote, \`%\${filters.searchQuery}%\`)`, `          like(arbitrationDecisions.caseTitle, containing(filters.searchQuery)),
          like(arbitrationDecisions.caseNumber, containing(filters.searchQuery)),
          like(arbitrationDecisions.summary, containing(filters.searchQuery)),
          like(arbitrationDecisions.headnote, containing(filters.searchQuery))`],
  // searchPrecedents
  [`  try {
    const conditions: SQL[] = [
      or(
        like(arbitrationDecisions.caseTitle, \`%\${query}%\`),
        like(arbitrationDecisions.caseNumber, \`%\${query}%\`),
        like(arbitrationDecisions.summary, \`%\${query}%\`),
        like(arbitrationDecisions.headnote, \`%\${query}%\`),
        like(arbitrationDecisions.fullText, \`%\${query}%\`)
      )!
    ];

    if (filters.precedentValue && filters.precedentValue.length > 0) {
      conditions.push(
        inArray(
          arbitrationDecisions.precedentValue,
          filters.precedentValue as PrecedentValueFilter[]
        )
      );
    }

    if (filters.tribunal && filters.tribunal.length > 0) {
      conditions.push(inArray(arbitrationDecisions.tribunal, filters.tribunal as TribunalFilter[]));
    }
`, `  const precedentValues = checkedValues<PrecedentValueFilter>(filters.precedentValue, arbitrationDecisions.precedentValue?.enumValues, 'precedentValue');
  const tribunals = checkedValues<TribunalFilter>(filters.tribunal, arbitrationDecisions.tribunal?.enumValues, 'tribunal');
  try {
    const conditions: SQL[] = [
      sharedDecisions(),
      or(
        like(arbitrationDecisions.caseTitle, containing(query)),
        like(arbitrationDecisions.caseNumber, containing(query)),
        like(arbitrationDecisions.summary, containing(query)),
        like(arbitrationDecisions.headnote, containing(query)),
        like(arbitrationDecisions.fullText, containing(query))
      )!
    ];

    if (precedentValues) conditions.push(inArray(arbitrationDecisions.precedentValue, precedentValues));
    if (tribunals) conditions.push(inArray(arbitrationDecisions.tribunal, tribunals));
`],
])
edit('app/api/precedents/search/route.ts', [
  [`    } catch (error) {
return standardErrorResponse(`, `    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'INVALID_PRECEDENT_FILTER') {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, (error as Error).message);
      }
return standardErrorResponse(`],
  [`  filters: z.record(z.string(), z.unknown()).prefault({}),`, `  // Only the filters the search reads, each a bounded list of bounded strings; their values are checked against the column's declared values.
  filters: z
    .object({
      precedentValue: z.array(z.string().max(50)).max(10),
      tribunal: z.array(z.string().max(50)).max(20),
    })
    .partial()
    .strict()
    .prefault({}),`],
])
console.log('ok')
