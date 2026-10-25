import { ApiError } from "@/lib/api/errors";
import { assertRunDuty, RunDutyError, type RunDuty, type RunParticipants } from "@/lib/employer-execution/run-duties";

/** Turns a segregation-of-duties refusal into a 403; any other failure is rethrown untouched. */
export function enforceRunDuty(duty: RunDuty, actorId: string | null | undefined, participants: RunParticipants): void {
  try {
    assertRunDuty(duty, actorId, participants);
  } catch (error) {
    if (error instanceof RunDutyError) throw ApiError.forbidden(error.message);
    throw error;
  }
}
