/**
 * Who may read a representative's satisfaction figures, and when there are enough responses to show them.
 *
 * The figures are the performance record of a named person. A mean of one or two ratings identifies who rated, so figures are shown only
 * from a minimum number of completed surveys; a steward reads their own figures, and reading anyone else's is an officer's act and is
 * recorded.
 */
export const MIN_RESPONSES_FOR_FIGURES = 5

export interface FigureRow {
  completedSurveys: number
}

export function withEnoughResponses<T extends FigureRow>(rows: readonly T[]): { shown: T[]; suppressed: number } {
  const shown = rows.filter((row) => row.completedSurveys >= MIN_RESPONSES_FOR_FIGURES)
  return { shown, suppressed: rows.length - shown.length }
}

/** A steward may read their own figures; any other representative's needs the officer floor. */
export function mayReadRepresentativeFigures(input: { callerUserId: string | null; representativeId: string; isOfficer: boolean }): boolean {
  return input.isOfficer || (input.callerUserId !== null && input.callerUserId === input.representativeId)
}
