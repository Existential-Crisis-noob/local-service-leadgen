ALTER TABLE "prospect_scores"
ADD COLUMN "qualified" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing high-priority/no-email records when upgrading an active
-- installation. New and re-assessed records use the campaign's exact filters.
UPDATE "prospect_scores"
SET "qualified" = true
WHERE "category" <> 'GOOD';
