export interface CandidateBusiness {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  category?: string;
  websiteUrl?: string;
  /** A directly-supplied email (e.g. a CSV "email" column) — never guessed. */
  email?: string;
  /** The URL/row/API record this candidate was collected from, for the audit trail. */
  sourceUrl?: string;
}

export interface DiscoverParams {
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
  radiusKm: number;
  industryKeywords: string[];
  desiredCount: number;
}

export interface DiscoverProgress {
  progress: number;
  stage: string;
  message: string;
}

export type ProgressReporter = (update: DiscoverProgress) => Promise<void> | void;

export interface SourceConnector {
  discover(params: DiscoverParams, onProgress?: ProgressReporter): Promise<CandidateBusiness[]>;
}
