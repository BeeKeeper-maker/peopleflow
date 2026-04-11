-- CreateTable
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "status" TEXT NOT NULL DEFAULT 'new',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesLead_email_idx" ON "SalesLead"("email");

-- CreateIndex
CREATE INDEX "SalesLead_status_idx" ON "SalesLead"("status");

-- CreateIndex
CREATE INDEX "SalesLead_createdAt_idx" ON "SalesLead"("createdAt");
