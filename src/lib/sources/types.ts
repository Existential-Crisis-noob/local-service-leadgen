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

export interface SourceConnector {
  discover(params: DiscoverParams): Promise<CandidateBusiness[]>;
}
