-- CDSSA: communication pause + deferred notice suppress audit
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "communicationPausedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "communicationPauseReason" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_communicationPausedAt_idx" ON "Customer"("communicationPausedAt");

ALTER TABLE "DeferredNotice" ADD COLUMN IF NOT EXISTS "suppressedAt" TIMESTAMP(3);
ALTER TABLE "DeferredNotice" ADD COLUMN IF NOT EXISTS "suppressReason" TEXT;

CREATE INDEX IF NOT EXISTS "CaslMessage_customerId_sentAt_idx" ON "CaslMessage"("customerId", "sentAt");
