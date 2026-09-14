-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'platform',
    "applicationFeeBps" INTEGER NOT NULL DEFAULT 250,
    "skipNoticeBusinessDays" INTEGER NOT NULL DEFAULT 3,
    "skipCooldownDays" INTEGER NOT NULL DEFAULT 180,
    "nsfRetryMax" INTEGER NOT NULL DEFAULT 1,
    "nsfRetryWindowDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "ontarioCorpNumber" TEXT,
    "stripeAccountId" TEXT,
    "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "caslConsentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "inviteToken" TEXT NOT NULL,
    "invitedAt" DATETIME,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalAmountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAST_DUE',
    "agingBucket" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "monthlyAmountCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_MANDATE',
    "startDate" DATETIME,
    "extendedByMonths" INTEGER NOT NULL DEFAULT 0,
    "lastSkipAt" DATETIME,
    "nextSkipAvailableAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripePaymentMethodId" TEXT,
    "padMandateAcceptedAt" DATETIME,
    "padWrittenConfirmSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentPlan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PadMandate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentPlanId" TEXT NOT NULL,
    "mandateType" TEXT NOT NULL DEFAULT 'PERSONAL_PAD',
    "payorName" TEXT NOT NULL,
    "payorEmail" TEXT NOT NULL,
    "bankLast4" TEXT,
    "institutionName" TEXT,
    "acceptedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "confirmationSentAt" DATETIME,
    "cancellationTerms" TEXT NOT NULL,
    "recourseTerms" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PadMandate_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentPlanId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "stripePaymentIntentId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "nsfRetryUsed" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "applicationFeeCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Installment_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkipRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentPlanId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "rejectionReason" TEXT,
    "appendedSequence" INTEGER,
    CONSTRAINT "SkipRequest_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SkipRequest_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransactionMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "installmentId" TEXT,
    "principalCents" INTEGER NOT NULL,
    "applicationFeeCents" INTEGER NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_email_key" ON "Business"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Business_stripeAccountId_key" ON "Business"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_inviteToken_key" ON "Customer"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_email_key" ON "Customer"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_externalRef_key" ON "Invoice"("businessId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "PadMandate_paymentPlanId_key" ON "PadMandate"("paymentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_paymentPlanId_sequence_key" ON "Installment"("paymentPlanId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SkipRequest_installmentId_key" ON "SkipRequest"("installmentId");
