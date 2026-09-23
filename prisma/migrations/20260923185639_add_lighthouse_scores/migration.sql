-- AlterTable
ALTER TABLE "website_assessments" ADD COLUMN     "lighthouseAccessibility" INTEGER,
ADD COLUMN     "lighthouseBestPractices" INTEGER,
ADD COLUMN     "lighthousePerformance" INTEGER,
ADD COLUMN     "lighthouseSeo" INTEGER;
