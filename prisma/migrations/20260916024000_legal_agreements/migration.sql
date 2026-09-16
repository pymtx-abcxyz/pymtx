-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "physicalAddress" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "supportEmail" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "saasAgreementAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "saasAgreementVersion" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- AlterTable
ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT;
ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "settlementTermsVersion" TEXT;
ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "agreementText" TEXT;
ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "settlementTermsText" TEXT;
