import {
  generateTemplateEmail,
  type EmailGenerationInput,
  type GeneratedEmail,
} from "@/lib/email/templateGenerator";

/**
 * Provider boundary for draft generation. The default provider is entirely
 * local and rule-based, so the product does not require a paid AI account.
 * A local model, user-supplied API key, or plan-provided model can implement
 * this same contract later without changing campaign or approval logic.
 */
export interface DraftGenerationProvider {
  readonly id: string;
  generate(input: EmailGenerationInput): Promise<GeneratedEmail>;
}

class RuleBasedDraftProvider implements DraftGenerationProvider {
  readonly id = "rule-based";

  async generate(input: EmailGenerationInput) {
    return generateTemplateEmail(input);
  }
}

const defaultProvider = new RuleBasedDraftProvider();

export function getDraftGenerationProvider(): DraftGenerationProvider {
  return defaultProvider;
}
