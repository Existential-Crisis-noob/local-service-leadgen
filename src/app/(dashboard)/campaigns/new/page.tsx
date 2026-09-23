import { createCampaignAction } from "../actions";
import { INDUSTRY_OPTIONS, CONNECTOR_OPTIONS } from "@/lib/campaigns";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1>New Campaign</h1>
      <p className="subtitle">
        Roofing businesses within 30 km of Calgary — tell us who to find and
        how to reach them.
      </p>

      {error && <p className="auth-error">{error}</p>}

      <form action={createCampaignAction} className="form-grid">
        <label className="field">
          Campaign name
          <input name="name" type="text" required placeholder="Calgary roofers – fall push" />
        </label>

        <fieldset className="field">
          <legend>Industry keywords</legend>
          {INDUSTRY_OPTIONS.map((industry) => (
            <label key={industry} className="checkbox-row">
              <input type="checkbox" name="industries" value={industry} />
              {industry.charAt(0).toUpperCase() + industry.slice(1)}
            </label>
          ))}
          <input
            name="otherKeywords"
            type="text"
            placeholder="Other keywords, comma separated"
          />
        </fieldset>

        <div className="field-row">
          <label className="field">
            City
            <input name="city" type="text" required placeholder="Calgary" />
          </label>
          <label className="field">
            Region / province / state
            <input name="region" type="text" placeholder="AB" />
          </label>
          <label className="field">
            Postal / ZIP code
            <input name="postalCode" type="text" placeholder="T2P 1J9" />
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
            Desired number of prospects
            <input name="desiredProspectCount" type="number" min="1" max="1000" defaultValue="50" required />
          </label>
        </div>

        <fieldset className="field">
          <legend>Approved lead source</legend>
          {CONNECTOR_OPTIONS.map((connector) => (
            <label key={connector.value} className="radio-row">
              <input
                type="radio"
                name="connectorType"
                value={connector.value}
                defaultChecked={connector.value === "OSM"}
                required
              />
              <span>
                <strong>{connector.label}</strong>
                <br />
                <span className="hint">{connector.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="field">
          <legend>Website-quality filters</legend>
          <label className="checkbox-row">
            <input type="checkbox" name="requireHttps" defaultChecked />
            Require HTTPS
          </label>
          <label className="checkbox-row">
            <input type="checkbox" name="requireMobileResponsive" defaultChecked />
            Require mobile-responsive layout
          </label>
          <label className="checkbox-row">
            <input type="checkbox" name="requireContactInfo" />
            Require visible contact information
          </label>
          <label className="checkbox-row">
            <input type="checkbox" name="requireQuoteButton" />
            Require a quote / request-service button
          </label>
        </fieldset>

        <div className="field-row">
          <label className="field">
            Max email length (characters)
            <input name="maxEmailLength" type="number" min="100" max="3000" defaultValue="900" required />
          </label>
          <label className="field">
            Follow-up delay (hours)
            <input name="followupDelayHours" type="number" min="1" max="720" defaultValue="72" required />
          </label>
          <label className="field">
            Max follow-ups
            <input name="maxFollowups" type="number" min="0" max="1" defaultValue="1" required />
            <span className="hint">MVP supports at most 1 follow-up.</span>
          </label>
        </div>

        <button type="submit" className="btn-primary">
          Create campaign
        </button>
      </form>
    </div>
  );
}
