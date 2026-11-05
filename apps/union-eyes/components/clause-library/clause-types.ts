/** The kinds of clause the library files a clause under: the search filter and the editor offer the same list. */
export const CLAUSE_TYPES = [
  { value: "wages", label: "Wages & Compensation" },
  { value: "benefits", label: "Benefits" },
  { value: "hours_of_work", label: "Hours of Work" },
  { value: "overtime", label: "Overtime" },
  { value: "vacation", label: "Vacation" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "grievance_procedure", label: "Grievance Procedure" },
  { value: "discipline", label: "Discipline" },
  { value: "seniority", label: "Seniority" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "job_security", label: "Job Security" },
  { value: "pension", label: "Pension" },
  { value: "other", label: "Other" },
] as const;
