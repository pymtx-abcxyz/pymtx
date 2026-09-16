-- Compliance hardening: dispute freeze, PAD cancel audit, deferred CDSSA notices
ALTER TABLE "PaymentPlan" ADD COLUMN IF NOT EXISTS "disputeFrozenAt" TIMESTAMP(3);
ALTER TABLE "PaymentPlan" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;

ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "PadMandate" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

CREATE TABLE IF NOT EXISTS "DeferredNotice" (
    "id" TEXT NOT NULL,
    "caslMessageId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachmentsJson" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeferredNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeferredNotice_caslMessageId_key" ON "DeferredNotice"("caslMessageId");
CREATE INDEX IF NOT EXISTS "DeferredNotice_sendAfter_sentAt_idx" ON "DeferredNotice"("sendAfter", "sentAt");
CREATE INDEX IF NOT EXISTS "DeferredNotice_businessId_idx" ON "DeferredNotice"("businessId");
CREATE INDEX IF NOT EXISTS "PaymentPlan_disputeFrozenAt_idx" ON "PaymentPlan"("disputeFrozenAt");

DO $$ BEGIN
  ALTER TABLE "DeferredNotice" ADD CONSTRAINT "DeferredNotice_caslMessageId_fkey"
    FOREIGN KEY ("caslMessageId") REFERENCES "CaslMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeferredNotice" ADD CONSTRAINT "DeferredNotice_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
