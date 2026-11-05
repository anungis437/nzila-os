/**
 * How an incident report typed into IncidentReportForm becomes the body of POST /api/health-safety/incidents.
 *
 * The route stores a narrower set of fields than the form asks for, and refuses a body that carries any field it does not store (and one that
 * names the organization). Nothing the reporter typed is dropped to fit: the facts that have no column of their own (the immediate cause,
 * the injuries, the witnesses' contacts, the preventive measures, how to reach the reporter) are written, labelled, into the incident's
 * narrative (`whatHappened`), which is where the route keeps what happened in the reporter's words.
 */
import type { IncidentFormData } from "./IncidentReportForm";

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The day and the time of day the reporter gave, as one instant in the reporter's own time zone. */
function incidentInstant(day: Date, timeOfDay: string): string {
  if (!TIME_OF_DAY.test(timeOfDay)) throw new Error("The incident time must be a time of day, such as 14:30.");
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const instant = new Date(day);
  instant.setHours(hours, minutes, 0, 0);
  return instant.toISOString();
}

const filled = (text: string | undefined): text is string => text !== undefined && text.trim() !== "";

function namesOf(text: string | undefined): string[] {
  return (text ?? "").split(/[\n,;]+/).map((name) => name.trim()).filter((name) => name !== "");
}

export function toIncidentRequest(data: IncidentFormData) {
  const narrative: string[] = [];
  narrative.push(`Immediate cause: ${data.immediateCause.trim()}`);
  if (data.injuriesOccurred && filled(data.injuryDetails)) narrative.push(`Injuries: ${data.injuryDetails.trim()}`);
  if (data.witnessesPresent && filled(data.witnessContacts)) narrative.push(`Witness contacts: ${data.witnessContacts.trim()}`);
  if (filled(data.preventiveMeasures)) narrative.push(`Preventive measures: ${data.preventiveMeasures.trim()}`);
  if (!data.isAnonymous && filled(data.reporterContact)) narrative.push(`Reporter contact: ${data.reporterContact.trim()}`);

  const witnesses = data.witnessesPresent ? namesOf(data.witnessNames) : [];

  return {
    incidentType: data.incidentType,
    severity: data.severity,
    incidentDate: incidentInstant(data.incidentDate, data.incidentTime),
    locationDescription: data.location.trim(),
    description: data.description.trim(),
    isAnonymous: data.isAnonymous,
    whatHappened: narrative.join("\n\n"),
    ...(filled(data.department) ? { departmentName: data.department.trim() } : {}),
    ...(filled(data.rootCause) ? { rootCauseAnalysis: data.rootCause.trim() } : {}),
    ...(filled(data.correctiveActions) ? { correctiveActionsSummary: data.correctiveActions.trim() } : {}),
    ...(!data.isAnonymous && filled(data.reportedBy) ? { reportedByName: data.reportedBy.trim() } : {}),
    ...(data.witnessesPresent ? { witnessesPresent: true, witnessNames: witnesses } : {}),
  };
}
