-- AlterTable
ALTER TABLE "BiometricDevice" ADD COLUMN     "alertSentAt" TIMESTAMP(3),
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPingAt" TIMESTAMP(3),
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "actualDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "isMaternityLeave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maternityPhase" TEXT,
ADD COLUMN     "postDeliveryDays" INTEGER,
ADD COLUMN     "preDeliveryDays" INTEGER;

-- AlterTable
ALTER TABLE "SalarySlip" ADD COLUMN     "festivalBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "crossesMidnight" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FestivalBonusConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "festivalType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "calculationBasis" TEXT NOT NULL DEFAULT 'basic',
    "percentageOfBasis" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "minimumServiceDays" INTEGER NOT NULL DEFAULT 180,
    "proRataForNewJoinee" BOOLEAN NOT NULL DEFAULT true,
    "includeProbation" BOOLEAN NOT NULL DEFAULT false,
    "includeContractual" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FestivalBonusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivalBonusPayment" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "basisAmount" DOUBLE PRECISION NOT NULL,
    "percentageApplied" DOUBLE PRECISION NOT NULL,
    "proRataFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isProRated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payrollMonth" INTEGER,
    "payrollYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bonusConfigId" TEXT NOT NULL,

    CONSTRAINT "FestivalBonusPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateDeductionPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lateThresholdMinutes" INTEGER NOT NULL DEFAULT 0,
    "monthlyReset" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "LateDeductionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateDeductionTier" (
    "id" TEXT NOT NULL,
    "tierOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "fromCount" INTEGER NOT NULL,
    "toCount" INTEGER NOT NULL,
    "deductionType" TEXT NOT NULL DEFAULT 'none',
    "deductionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issueWarning" BOOLEAN NOT NULL DEFAULT false,
    "warningLevel" TEXT NOT NULL DEFAULT 'verbal',
    "policyId" TEXT NOT NULL,

    CONSTRAINT "LateDeductionTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PFAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingDate" TIMESTAMP(3),
    "employeeBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastInterestDate" TIMESTAMP(3),
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "PFAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PFTransaction" (
    "id" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "runningBalance" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceMonth" INTEGER,
    "referenceYear" INTEGER,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pfAccountId" TEXT NOT NULL,

    CONSTRAINT "PFTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalSteps" INTEGER NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "currentApproverRole" TEXT,
    "currentApproverId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStepLog" (
    "id" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "assignedRole" TEXT NOT NULL,
    "assignedToId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3),
    "notes" TEXT,
    "timeToAction" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvalRequestId" TEXT NOT NULL,

    CONSTRAINT "ApprovalStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RBACPermission" (
    "id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "departmentIds" JSONB,
    "branchIds" JSONB,
    "designationMinGrade" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RBACPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHealthLog" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "DeviceHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FestivalBonusConfig_organizationId_idx" ON "FestivalBonusConfig"("organizationId");

-- CreateIndex
CREATE INDEX "FestivalBonusConfig_year_idx" ON "FestivalBonusConfig"("year");

-- CreateIndex
CREATE UNIQUE INDEX "FestivalBonusConfig_organizationId_festivalType_year_key" ON "FestivalBonusConfig"("organizationId", "festivalType", "year");

-- CreateIndex
CREATE INDEX "FestivalBonusPayment_employeeId_idx" ON "FestivalBonusPayment"("employeeId");

-- CreateIndex
CREATE INDEX "FestivalBonusPayment_bonusConfigId_idx" ON "FestivalBonusPayment"("bonusConfigId");

-- CreateIndex
CREATE INDEX "FestivalBonusPayment_status_idx" ON "FestivalBonusPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FestivalBonusPayment_employeeId_bonusConfigId_key" ON "FestivalBonusPayment"("employeeId", "bonusConfigId");

-- CreateIndex
CREATE INDEX "LateDeductionPolicy_organizationId_idx" ON "LateDeductionPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "LateDeductionTier_policyId_idx" ON "LateDeductionTier"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "LateDeductionTier_policyId_tierOrder_key" ON "LateDeductionTier"("policyId", "tierOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PFAccount_employeeId_key" ON "PFAccount"("employeeId");

-- CreateIndex
CREATE INDEX "PFAccount_organizationId_idx" ON "PFAccount"("organizationId");

-- CreateIndex
CREATE INDEX "PFAccount_status_idx" ON "PFAccount"("status");

-- CreateIndex
CREATE INDEX "PFTransaction_pfAccountId_idx" ON "PFTransaction"("pfAccountId");

-- CreateIndex
CREATE INDEX "PFTransaction_transactionType_idx" ON "PFTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "PFTransaction_transactionDate_idx" ON "PFTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "PFTransaction_referenceMonth_referenceYear_idx" ON "PFTransaction"("referenceMonth", "referenceYear");

-- CreateIndex
CREATE INDEX "ApprovalRequest_organizationId_idx" ON "ApprovalRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_currentApproverId_idx" ON "ApprovalRequest"("currentApproverId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requesterId_idx" ON "ApprovalRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_idx" ON "ApprovalRequest"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_entityType_entityId_key" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalStepLog_approvalRequestId_idx" ON "ApprovalStepLog"("approvalRequestId");

-- CreateIndex
CREATE INDEX "ApprovalStepLog_assignedToId_idx" ON "ApprovalStepLog"("assignedToId");

-- CreateIndex
CREATE INDEX "ApprovalStepLog_status_idx" ON "ApprovalStepLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStepLog_approvalRequestId_stepNumber_key" ON "ApprovalStepLog"("approvalRequestId", "stepNumber");

-- CreateIndex
CREATE INDEX "RBACPermission_userId_idx" ON "RBACPermission"("userId");

-- CreateIndex
CREATE INDEX "RBACPermission_organizationId_idx" ON "RBACPermission"("organizationId");

-- CreateIndex
CREATE INDEX "RBACPermission_permission_idx" ON "RBACPermission"("permission");

-- CreateIndex
CREATE INDEX "RBACPermission_isActive_idx" ON "RBACPermission"("isActive");

-- CreateIndex
CREATE INDEX "DeviceHealthLog_deviceId_idx" ON "DeviceHealthLog"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceHealthLog_checkedAt_idx" ON "DeviceHealthLog"("checkedAt");

-- CreateIndex
CREATE INDEX "BiometricDevice_isOnline_idx" ON "BiometricDevice"("isOnline");

-- AddForeignKey
ALTER TABLE "FestivalBonusConfig" ADD CONSTRAINT "FestivalBonusConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivalBonusPayment" ADD CONSTRAINT "FestivalBonusPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivalBonusPayment" ADD CONSTRAINT "FestivalBonusPayment_bonusConfigId_fkey" FOREIGN KEY ("bonusConfigId") REFERENCES "FestivalBonusConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateDeductionPolicy" ADD CONSTRAINT "LateDeductionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateDeductionTier" ADD CONSTRAINT "LateDeductionTier_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LateDeductionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PFAccount" ADD CONSTRAINT "PFAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PFAccount" ADD CONSTRAINT "PFAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PFTransaction" ADD CONSTRAINT "PFTransaction_pfAccountId_fkey" FOREIGN KEY ("pfAccountId") REFERENCES "PFAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepLog" ADD CONSTRAINT "ApprovalStepLog_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepLog" ADD CONSTRAINT "ApprovalStepLog_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RBACPermission" ADD CONSTRAINT "RBACPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RBACPermission" ADD CONSTRAINT "RBACPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHealthLog" ADD CONSTRAINT "DeviceHealthLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
