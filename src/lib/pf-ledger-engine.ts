/**
 * Provident Fund (PF) Ledger Engine
 *
 * Double-entry ledger system for PF account management.
 *
 * Bangladesh PF Rules:
 *   - Employee & Employer each contribute 10% of basic salary (configurable per structure)
 *   - PF is tax-deductible for the employee
 *   - Interest rate: typically 12% per annum (BD government rate)
 *   - Interest calculated on monthly average balance
 *   - Withdrawal requires minimum 5 years of service (unless resignation/death)
 *   - Settlement: Employee gets full employee + employer + interest on separation
 *
 * Ledger Architecture:
 *   - Every PF movement is a PFTransaction with a running balance
 *   - Credits: employee_contribution, employer_contribution, interest_credit, adjustment(+)
 *   - Debits: withdrawal, settlement, adjustment(-)
 *   - Running balance is computed continuously — never recalculated from scratch
 *   - Annual interest is calculated on the opening balance of each month (simple interest)
 *
 * Integration:
 *   - payroll-engine.ts calls `recordMonthlyContributions()` after salary slip creation
 *   - Annual interest job calls `calculateAndCreditInterest()`
 *   - Settlement called on employee separation/resignation
 */

import prisma from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────────

export interface PFContributionInput {
    employeeId: string;
    month: number; // 1-12
    year: number;
    employeeAmount: number;
    employerAmount: number;
}

export interface PFContributionResult {
    success: boolean;
    pfAccountId: string;
    employeeContribution: number;
    employerContribution: number;
    newEmployeeBalance: number;
    newEmployerBalance: number;
    newTotalBalance: number;
    error?: string;
}

export interface PFAccountSummary {
    accountId: string;
    accountNumber: string | null;
    status: string;
    employeeBalance: number;
    employerBalance: number;
    interestBalance: number;
    totalBalance: number;
    openingDate: Date;
    interestRate: number;
    lastInterestDate: Date | null;
    transactionCount: number;
}

export interface PFInterestResult {
    accountId: string;
    interestAmount: number;
    newInterestBalance: number;
    newTotalBalance: number;
    calculationBasis: number;
    interestRate: number;
    period: string;
}

// ── Account Management ──────────────────────────────────────────────

/**
 * Ensure a PF account exists for an employee. Creates one if not.
 * Called lazily on first contribution or explicitly during onboarding.
 */
export async function ensurePFAccount(
    employeeId: string,
    organizationId: string
): Promise<string> {
    const existing = await prisma.pFAccount.findUnique({
        where: { employeeId },
        select: { id: true },
    });

    if (existing) return existing.id;

    // Create new PF account
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { pfNumber: true, pfEnabled: true, joiningDate: true },
    });

    if (!employee) throw new Error(`Employee ${employeeId} not found`);
    if (!employee.pfEnabled) throw new Error("PF is not enabled for this employee");

    const account = await prisma.pFAccount.create({
        data: {
            employeeId,
            organizationId,
            accountNumber: employee.pfNumber,
            openingDate: employee.joiningDate,
            status: "active",
        },
    });

    return account.id;
}

// ── Monthly Contributions ───────────────────────────────────────────

/**
 * Record monthly PF contributions (employee + employer).
 *
 * Called by the payroll engine after salary slip creation.
 * Creates two ledger entries (employee + employer) and updates running balances.
 *
 * CRITICAL: This is idempotent — if contributions for this month already exist,
 * it returns the existing data instead of double-posting.
 */
export async function recordMonthlyContributions(
    input: PFContributionInput
): Promise<PFContributionResult> {
    const { employeeId, month, year, employeeAmount, employerAmount } = input;

    // Check if contributions already exist for this month (idempotency guard)
    const existing = await prisma.pFTransaction.findFirst({
        where: {
            pfAccount: { employeeId },
            transactionType: "employee_contribution",
            referenceMonth: month,
            referenceYear: year,
        },
        select: {
            pfAccountId: true,
            pfAccount: {
                select: {
                    employeeBalance: true,
                    employerBalance: true,
                    totalBalance: true,
                },
            },
        },
    });

    if (existing) {
        return {
            success: true,
            pfAccountId: existing.pfAccountId,
            employeeContribution: employeeAmount,
            employerContribution: employerAmount,
            newEmployeeBalance: existing.pfAccount.employeeBalance,
            newEmployerBalance: existing.pfAccount.employerBalance,
            newTotalBalance: existing.pfAccount.totalBalance,
            error: "Contributions already recorded for this month (idempotent skip)",
        };
    }

    // Ensure PF account exists
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { organizationId: true },
    });
    if (!employee) throw new Error(`Employee ${employeeId} not found`);

    const pfAccountId = await ensurePFAccount(employeeId, employee.organizationId);

    // Get current balances for running balance calculation
    const account = await prisma.pFAccount.findUnique({
        where: { id: pfAccountId },
        select: { employeeBalance: true, employerBalance: true, interestBalance: true, totalBalance: true },
    });
    if (!account) throw new Error("PF account not found");

    const monthName = getMonthName(month);

    // Use a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
        // 1. Employee contribution entry
        const newEmployeeBalance = account.employeeBalance + employeeAmount;
        const runningAfterEmployee = account.totalBalance + employeeAmount;

        await tx.pFTransaction.create({
            data: {
                pfAccountId,
                transactionType: "employee_contribution",
                amount: employeeAmount,
                runningBalance: runningAfterEmployee,
                description: `${monthName} ${year} Employee Contribution`,
                referenceMonth: month,
                referenceYear: year,
            },
        });

        // 2. Employer contribution entry
        const newEmployerBalance = account.employerBalance + employerAmount;
        const runningAfterEmployer = runningAfterEmployee + employerAmount;

        await tx.pFTransaction.create({
            data: {
                pfAccountId,
                transactionType: "employer_contribution",
                amount: employerAmount,
                runningBalance: runningAfterEmployer,
                description: `${monthName} ${year} Employer Contribution`,
                referenceMonth: month,
                referenceYear: year,
            },
        });

        // 3. Update account balances
        await tx.pFAccount.update({
            where: { id: pfAccountId },
            data: {
                employeeBalance: newEmployeeBalance,
                employerBalance: newEmployerBalance,
                totalBalance: runningAfterEmployer,
            },
        });

        return {
            newEmployeeBalance,
            newEmployerBalance,
            newTotalBalance: runningAfterEmployer,
        };
    });

    return {
        success: true,
        pfAccountId,
        employeeContribution: employeeAmount,
        employerContribution: employerAmount,
        ...result,
    };
}

// ── Annual Interest Calculation ─────────────────────────────────────

/**
 * Calculate and credit annual interest to a PF account.
 *
 * Interest Calculation Method (Bangladesh Standard):
 *   - Simple interest on the OPENING BALANCE of the fiscal year
 *   - Rate: Typically 12% per annum (configurable per account)
 *   - Credited once per year at fiscal year end
 *
 * Formula:
 *   Interest = Opening Balance × (Rate / 100)
 *
 * Note: Some organizations use monthly compounding on average monthly balance.
 * This implementation uses the simpler annual method which is standard for most
 * BD companies. For monthly compounding, extend this function.
 */
export async function calculateAndCreditInterest(
    pfAccountId: string,
    fiscalYear: string // "2024-25"
): Promise<PFInterestResult> {
    const account = await prisma.pFAccount.findUnique({
        where: { id: pfAccountId },
    });

    if (!account) throw new Error(`PF Account ${pfAccountId} not found`);
    if (account.status !== "active") throw new Error("Cannot calculate interest on inactive account");

    // Calculate interest on the total balance (employee + employer)
    const calculationBasis = account.employeeBalance + account.employerBalance;
    const interestAmount = Math.round(calculationBasis * (account.interestRate / 100));

    if (interestAmount <= 0) {
        return {
            accountId: pfAccountId,
            interestAmount: 0,
            newInterestBalance: account.interestBalance,
            newTotalBalance: account.totalBalance,
            calculationBasis,
            interestRate: account.interestRate,
            period: fiscalYear,
        };
    }

    // Credit interest
    const result = await prisma.$transaction(async (tx) => {
        const newInterestBalance = account.interestBalance + interestAmount;
        const newTotalBalance = account.totalBalance + interestAmount;

        // Create interest credit transaction
        await tx.pFTransaction.create({
            data: {
                pfAccountId,
                transactionType: "interest_credit",
                amount: interestAmount,
                runningBalance: newTotalBalance,
                description: `FY${fiscalYear} Interest @${account.interestRate}% on ৳${calculationBasis.toLocaleString("en-BD")}`,
            },
        });

        // Update account balances
        await tx.pFAccount.update({
            where: { id: pfAccountId },
            data: {
                interestBalance: newInterestBalance,
                totalBalance: newTotalBalance,
                lastInterestDate: new Date(),
            },
        });

        return { newInterestBalance, newTotalBalance };
    });

    return {
        accountId: pfAccountId,
        interestAmount,
        newInterestBalance: result.newInterestBalance,
        newTotalBalance: result.newTotalBalance,
        calculationBasis,
        interestRate: account.interestRate,
        period: fiscalYear,
    };
}

/**
 * Calculate and credit interest for ALL active PF accounts in an organization.
 * Call this from a BullMQ job at fiscal year end.
 */
export async function creditInterestForOrganization(
    organizationId: string,
    fiscalYear: string
): Promise<{
    processed: number;
    totalInterest: number;
    errors: string[];
}> {
    const accounts = await prisma.pFAccount.findMany({
        where: { organizationId, status: "active" },
        select: { id: true },
    });

    let processed = 0;
    let totalInterest = 0;
    const errors: string[] = [];

    for (const account of accounts) {
        try {
            const result = await calculateAndCreditInterest(account.id, fiscalYear);
            totalInterest += result.interestAmount;
            processed++;
        } catch (error) {
            errors.push(`Account ${account.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return { processed, totalInterest, errors };
}

// ── Settlement ──────────────────────────────────────────────────────

/**
 * Settle a PF account on employee separation (resignation, termination, retirement).
 *
 * Creates a settlement transaction debiting the full balance and marks the account as settled.
 * The settlement amount should be included in the final & full settlement payslip.
 */
export async function settlePFAccount(
    employeeId: string,
    reason: string = "Employee separation"
): Promise<{
    settlementAmount: number;
    breakdown: {
        employeeContributions: number;
        employerContributions: number;
        interestAccrued: number;
    };
}> {
    const account = await prisma.pFAccount.findUnique({
        where: { employeeId },
    });

    if (!account) throw new Error("No PF account found for this employee");
    if (account.status === "settled") throw new Error("PF account is already settled");

    const settlementAmount = account.totalBalance;

    await prisma.$transaction(async (tx) => {
        // Create settlement transaction (debit full balance)
        await tx.pFTransaction.create({
            data: {
                pfAccountId: account.id,
                transactionType: "settlement",
                amount: -settlementAmount, // Negative = debit
                runningBalance: 0,
                description: `Full settlement: ${reason}. ৳${settlementAmount.toLocaleString("en-BD")}`,
            },
        });

        // Mark account as settled
        await tx.pFAccount.update({
            where: { id: account.id },
            data: {
                status: "settled",
                closingDate: new Date(),
                employeeBalance: 0,
                employerBalance: 0,
                interestBalance: 0,
                totalBalance: 0,
            },
        });
    });

    return {
        settlementAmount,
        breakdown: {
            employeeContributions: account.employeeBalance,
            employerContributions: account.employerBalance,
            interestAccrued: account.interestBalance,
        },
    };
}

// ── Account Summary & Reporting ─────────────────────────────────────

/**
 * Get PF account summary for an employee.
 */
export async function getPFAccountSummary(
    employeeId: string
): Promise<PFAccountSummary | null> {
    const account = await prisma.pFAccount.findUnique({
        where: { employeeId },
        include: {
            _count: { select: { transactions: true } },
        },
    });

    if (!account) return null;

    return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        status: account.status,
        employeeBalance: account.employeeBalance,
        employerBalance: account.employerBalance,
        interestBalance: account.interestBalance,
        totalBalance: account.totalBalance,
        openingDate: account.openingDate,
        interestRate: account.interestRate,
        lastInterestDate: account.lastInterestDate,
        transactionCount: account._count.transactions,
    };
}

/**
 * Get PF transaction history (ledger statement) for an employee.
 */
export async function getPFStatement(
    employeeId: string,
    options?: {
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
    }
): Promise<Array<{
    id: string;
    transactionType: string;
    amount: number;
    runningBalance: number;
    description: string;
    transactionDate: Date;
}>> {
    const account = await prisma.pFAccount.findUnique({
        where: { employeeId },
        select: { id: true },
    });

    if (!account) return [];

    return prisma.pFTransaction.findMany({
        where: {
            pfAccountId: account.id,
            ...(options?.fromDate || options?.toDate
                ? {
                    transactionDate: {
                        ...(options.fromDate ? { gte: options.fromDate } : {}),
                        ...(options.toDate ? { lte: options.toDate } : {}),
                    },
                }
                : {}),
        },
        select: {
            id: true,
            transactionType: true,
            amount: true,
            runningBalance: true,
            description: true,
            transactionDate: true,
        },
        orderBy: { transactionDate: "desc" },
        take: options?.limit || 100,
    });
}

// ── Utility ─────────────────────────────────────────────────────────

function getMonthName(month: number): string {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    return months[month - 1] || "";
}
