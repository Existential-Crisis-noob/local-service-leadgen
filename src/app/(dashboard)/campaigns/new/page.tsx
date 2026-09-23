import Link from "next/link";
import { createCampaignAction } from "../actions";
import { INDUSTRY_OPTIONS, CONNECTOR_OPTIONS } from "@/lib/campaigns";

const QUALITY_FILTERS = [
  ["targetNoWebsite", "No official website", "Strong manual-contact prospect"],
  ["targetBroken", "Website does not load or has broken pages", "Highest-priority website issue"],
  ["targetMissingHttps", "Website is not HTTPS", "Security and trust issue"],
  ["targetNotMobile", "Not mobile responsive", "Viewport and mobile-layout signal"],
  ["targetMissingContact", "No clear contact information", "Phone/email/contact path missing"],
  ["targetMissingQuote", "No quote or request-service action", "Weak conversion path"],
  ["targetOutdatedCopyright", "Copyright is more than two years old", "Freshness signal"],
  ["targetWeakService", "Missing or weak service information", "Thin marketing content"],
] as const;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Campaign setup</div>
          <h1>Create a discovery campaign</h1>
          <p className="subtitle">
            Choose a market and an approved source. No unsupported map, marketplace or social-page scraping.
          </p>
        </div>
        <Link href="/campaigns" className="btn-secondary">
          Cancel
        </Link>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <form action={createCampaignAction} className="form-grid campaign-form">
        <section className="form-section">
          <div className="form-section-head">
            <span className="step-number">1</span>
            <div>
              <h2>Market and search intent</h2>
              <p>Use one precise service or add related terms to improve source coverage.</p>
            </div>
          </div>

          <label className="field">
            Campaign name
            <input name="name" type="text" maxLength={120} required />
            <span className="hint">Visible only to members of this workspace.</span>
          </label>

          <fieldset className="field">
            <legend>Common service types (optional)</legend>
            <div className="keyword-pills">
              {INDUSTRY_OPTIONS.map((industry) => (
                <label key={industry} className="checkbox-row">
                  <input type="checkbox" name="industries" value={industry} />
                  {industry === "hvac" ? "HVAC" : industry.charAt(0).toUpperCase() + industry.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            Industry or service keywords
            <input name="otherKeywords" type="text" />
            <span className="hint">
              Enter any service the user wants to find. Separate related terms with commas, such as roofing, roof repair.
            </span>
          </label>

          <div className="field-row">
            <label className="field">
              City
              <input name="city" type="text" list="city-options" required />
              <datalist id="city-options">
                <option value="Calgary" />
                <option value="Edmonton" />
                <option value="Vancouver" />
                <option value="Toronto" />
                <option value="Ottawa" />
                <option value="Montreal" />
                <option value="Winnipeg" />
                <option value="Halifax" />
              </datalist>
            </label>
            <label className="field">
              Province / state code
              <input name="region" type="text" list="region-options" maxLength={3} />
              <datalist id="region-options">
                {[
                  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
                ].map((code) => <option value={code} key={code} />)}
              </datalist>
              <span className="hint">CanadaOne requires a two-letter Canadian code.</span>
            </label>
            <label className="field">
              Postal / ZIP code (optional)
              <input name="postalCode" type="text" maxLength={12} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              Country code
              <input name="countryCode" type="text" defaultValue="CA" maxLength={2} required />
            </label>
            <label className="field">
              Search radius (km)
              <input name="radiusKm" type="number" step="0.1" min="1" max="500" defaultValue="30" required />
            </label>
            <label className="field">
              Prospect target
              <input name="desiredProspectCount" type="number" min="1" max="1000" defaultValue="50" required />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <span className="step-number">2</span>
            <div>
              <h2>Approved lead source</h2>
              <p>Each source has its own connector and permission boundary.</p>
            </div>
          </div>

          <fieldset className="field">
            <legend>Select one source</legend>
            <div className="source-grid">
              {CONNECTOR_OPTIONS.map((connector) => (
                <label key={connector.value} className="source-option">
                  <input
                    type="radio"
                    name="connectorType"
                    value={connector.value}
                    defaultChecked={connector.value === "OSM"}
                    required
                  />
                  <span>
                    <strong>{connector.label}</strong>
                    <small>{connector.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="source-note">
            <strong>Source guardrails:</strong>
            <span>
              Business-owned public sites are inspected. Login-protected pages and unsupported marketplace, social or map-result URLs are rejected.
            </span>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <span className="step-number">3</span>
            <div>
              <h2>Qualification rules</h2>
              <p>A prospect is marked qualified when at least one selected condition is observed.</p>
            </div>
          </div>

          <div className="check-grid">
            {QUALITY_FILTERS.map(([name, label, detail]) => (
              <label key={name} className="source-option">
                <input type="checkbox" name={name} defaultChecked />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </label>
            ))}
            <label className="source-option">
              <input type="checkbox" name="targetGoodWebsite" />
              <span>
                <strong>Good website and marketing</strong>
                <small>Include low-priority prospects with no observed issue.</small>
              </span>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <span className="step-number">4</span>
            <div>
              <h2>Outreach limits</h2>
              <p>Rule-based industry templates are used; every first email requires human approval.</p>
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              Maximum email length
              <input name="maxEmailLength" type="number" min="300" max="3000" defaultValue="900" required />
              <span className="hint">Characters, including sender identity and unsubscribe instructions.</span>
            </label>
            <label className="field">
              Follow-up delay
              <input name="followupDelayHours" type="number" min="24" max="720" defaultValue="72" required />
              <span className="hint">Hours after the initial message.</span>
            </label>
            <label className="field">
              Maximum follow-ups
              <select name="maxFollowups" defaultValue="1" required>
                <option value="0">No follow-up</option>
                <option value="1">One follow-up</option>
              </select>
            </label>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Create campaign
          </button>
        </div>
      </form>
    </div>
  );
}
