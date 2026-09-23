const BOUNCE_SENDER_PATTERN = /mailer-daemon|postmaster/i;
const BOUNCE_SUBJECT_PATTERN =
  /undeliver|delivery status notification|mail delivery failed|returned to sender|delivery has failed/i;

/** Best-effort bounce detection from the reply's From/Subject headers —
 * documented as a heuristic, not a full bounce-parsing implementation. */
export function isBounceMessage(fromHeader: string, subjectHeader: string): boolean {
  return BOUNCE_SENDER_PATTERN.test(fromHeader) || BOUNCE_SUBJECT_PATTERN.test(subjectHeader);
}
