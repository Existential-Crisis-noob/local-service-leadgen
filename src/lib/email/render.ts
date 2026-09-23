export interface EmailParts {
  greeting: string;
  issue: string;
  valueProp: string;
  /** Sender identity — required, never trimmed away. */
  signature: string;
  /** Unsubscribe instructions — required, never trimmed away. */
  footer: string;
}

/**
 * Assembles the email body within maxLength. The signature and footer
 * (sender identity + unsubscribe instructions) are never dropped; the
 * value-prop paragraph is dropped first if the message is too long, and as
 * a last resort the issue sentence is trimmed to fit.
 */
export function renderEmail(parts: EmailParts, maxLength: number): string {
  const withValueProp = [parts.greeting, parts.issue, parts.valueProp, parts.signature, parts.footer].join(
    "\n\n"
  );
  if (withValueProp.length <= maxLength) return withValueProp;

  const withoutValueProp = [parts.greeting, parts.issue, parts.signature, parts.footer].join("\n\n");
  if (withoutValueProp.length <= maxLength) return withoutValueProp;

  const fixed = [parts.greeting, parts.signature, parts.footer].join("\n\n");
  const separatorsLength = "\n\n".length * 3;
  const budget = Math.max(0, maxLength - fixed.length - separatorsLength);
  const trimmedIssue = parts.issue.slice(0, budget);

  return [parts.greeting, trimmedIssue, parts.signature, parts.footer].join("\n\n");
}
