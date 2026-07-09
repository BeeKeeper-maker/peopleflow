/**
 * PeopleFlow Expense Engine
 *
 * Handles:
 *   1. Multi-currency conversion (foreign currency → BDT)
 *   2. Mileage calculation (distance × rate)
 *   3. Per-diem calculation (days × daily rate)
 *   4. Policy violation detection (over-limit, missing receipt, duplicate)
 *
 * The engine is called at claim submission time to compute:
 *   - amountInBDT (from currency + exchangeRate)
 *   - amount (from distance × mileageRate OR perDiemDays × perDiemRate)
 *   - policyViolation / policyViolationType
 */

import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";

// ── Supported Currencies ─────────────────────────────────────────────

export const SUPPORTED_CURRENCIES: Array<{ code: string; name: string; symbol: string }> = [
    { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
    { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
    { code: "AED", name: "UAE Dirham", symbol: "AED" },
    { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
    { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
    { code: "NPR", name: "Nepalese Rupee", symbol: "रू" },
];

export const CURRENCY_MAP = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

// ── Exchange Rate ────────────────────────────────────────────────────

/**
 * Get the exchange rate for a currency (1 unit of currency = X BDT).
 * Reads from the cached ExchangeRate table. If BDT, returns 1.0.
 * If no cached rate exists, returns null (caller should reject).
 */
export async function getExchangeRate(currency: string): Promise<number | null> {
    if (currency === "BDT") return 1.0;

    const rate = await prisma.exchangeRate.findUnique({
        where: {
            baseCurrency_quoteCurrency: {
                baseCurrency: "BDT",
                quoteCurrency: currency,
            },
        },
    });

    if (!rate) {
        apiLogger.warn({ currency }, "No cached exchange rate found");
        return null;
    }

    // Check if rate is stale (> 7 days)
    const ageMs = Date.now() - rate.fetchedAt.getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) {
        apiLogger.warn({ currency, ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000)) }, "Exchange rate is stale");
    }

    return Number(rate.rate);
}

/**
 * Convert an amount from a foreign currency to BDT.
 * Returns null if no exchange rate is available.
 */
export async function convertToBDT(
    amount: number,
    currency: string,
): Promise<{ amountInBDT: number; exchangeRate: number } | null> {
    const rate = await getExchangeRate(currency);
    if (rate === null) return null;

    return {
        amountInBDT: Math.round(amount * rate * 100) / 100,
        exchangeRate: rate,
    };
}

// ── Mileage Calculation ──────────────────────────────────────────────

/**
 * Calculate mileage reimbursement.
 *
 * distance: in km (or miles, if distanceUnit = "mile")
 * mileageRate: BDT per km (from ExpenseCategory)
 * distanceUnit: "km" or "mile" (miles are converted to km: 1 mile = 1.60934 km)
 *
 * Returns the amount in BDT.
 */
export function calculateMileage(
    distance: number,
    mileageRate: number,
    distanceUnit: string = "km",
): number {
    if (distance <= 0 || mileageRate <= 0) return 0;

    // Convert miles to km if needed
    const distanceInKm = distanceUnit === "mile" ? distance * 1.60934 : distance;

    return Math.round(distanceInKm * mileageRate * 100) / 100;
}

// ── Per-diem Calculation ─────────────────────────────────────────────

/**
 * Calculate per-diem reimbursement.
 *
 * perDiemDays: number of days (can be fractional: 0.5 for half day)
 * perDiemRate: daily rate in BDT (from ExpenseCategory)
 *
 * Returns the amount in BDT.
 */
export function calculatePerDiem(perDiemDays: number, perDiemRate: number): number {
    if (perDiemDays <= 0 || perDiemRate <= 0) return 0;

    return Math.round(perDiemDays * perDiemRate * 100) / 100;
}

// ── Policy Violation Detection ───────────────────────────────────────

export interface PolicyViolationResult {
    hasViolation: boolean;
    violationType?: string;
    violationDescription?: string;
}

/**
 * Check an expense claim against org policy.
 *
 * Checks:
 *   1. Over-limit: amountInBDT > category.maxAmount (if set)
 *   2. Missing receipt: category.requiresReceipt && !receiptUrl
 *   3. Monthly limit exceeded: sum of employee's claims this month > category.monthlyLimit
 *
 * Returns the violation details (or no violation).
 */
export async function checkExpensePolicy(params: {
    employeeId: string;
    organizationId: string;
    categoryId: string;
    amountInBDT: number;
    receiptUrl: string | null;
    expenseDate: Date;
    claimId?: string; // exclude self from monthly sum (for edits)
}): Promise<PolicyViolationResult> {
    const { employeeId, organizationId, categoryId, amountInBDT, receiptUrl, expenseDate, claimId } = params;

    // Load category
    const category = await prisma.expenseCategory.findFirst({
        where: { id: categoryId, organizationId },
    });

    if (!category) {
        return {
            hasViolation: true,
            violationType: "invalid_category",
            violationDescription: "Expense category not found",
        };
    }

    // Check 1: over-limit
    if (category.maxAmount && amountInBDT > Number(category.maxAmount)) {
        return {
            hasViolation: true,
            violationType: "over_limit",
            violationDescription: `Amount (৳${amountInBDT.toFixed(2)}) exceeds category limit of ৳${Number(category.maxAmount).toFixed(2)}`,
        };
    }

    // Check 2: missing receipt
    if (category.requiresReceipt && !receiptUrl) {
        return {
            hasViolation: true,
            violationType: "missing_receipt",
            violationDescription: `A receipt is required for ${category.name} expenses`,
        };
    }

    // Check 3: monthly limit
    if (category.monthlyLimit) {
        const monthStart = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1);
        const monthEnd = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 1);

        const where: Record<string, unknown> = {
            employeeId,
            categoryId,
            status: { in: ["submitted", "approved", "reimbursed"] },
            expenseDate: { gte: monthStart, lt: monthEnd },
        };

        if (claimId) {
            where.id = { not: claimId };
        }

        const monthlyClaims = await prisma.expenseClaim.aggregate({
            where,
            _sum: { amountInBDT: true },
        });

        const monthlyTotal = Number(monthlyClaims._sum.amountInBDT) || 0;
        if (monthlyTotal + amountInBDT > Number(category.monthlyLimit)) {
            return {
                hasViolation: true,
                violationType: "monthly_limit_exceeded",
                violationDescription: `Monthly limit for ${category.name} would be exceeded (current: ৳${monthlyTotal.toFixed(2)}, this claim: ৳${amountInBDT.toFixed(2)}, limit: ৳${Number(category.monthlyLimit).toFixed(2)})`,
            };
        }
    }

    return { hasViolation: false };
}

// ── Full Claim Calculation ───────────────────────────────────────────

export interface ClaimCalculationResult {
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBDT: number;
    policyViolation: PolicyViolationResult;
}

/**
 * Calculate the full claim amount (used at submission time).
 *
 * For standard categories:
 *   - amount is provided by the user
 *   - amountInBDT = amount × exchangeRate
 *
 * For mileage categories:
 *   - amount = distance × mileageRate (computed)
 *   - currency is always BDT
 *   - amountInBDT = amount
 *
 * For per-diem categories:
 *   - amount = perDiemDays × perDiemRate (computed)
 *   - currency is always BDT
 *   - amountInBDT = amount
 *
 * Then runs policy violation check.
 */
export async function calculateClaim(params: {
    employeeId: string;
    organizationId: string;
    categoryId: string;
    categoryType: string;
    amount?: number;
    currency: string;
    distance?: number;
    distanceUnit?: string;
    perDiemDays?: number;
    perDiemRate?: number;
    receiptUrl: string | null;
    expenseDate: Date;
    claimId?: string;
}): Promise<ClaimCalculationResult> {
    const {
        employeeId,
        organizationId,
        categoryId,
        categoryType,
        amount: userAmount,
        currency,
        distance,
        distanceUnit,
        perDiemDays,
        perDiemRate,
        receiptUrl,
        expenseDate,
        claimId,
    } = params;

    let amount: number;
    let finalCurrency: string = currency;
    let exchangeRate: number = 1.0;
    let amountInBDT: number;

    if (categoryType === "mileage") {
        // Mileage: amount is computed from distance × rate
        if (!distance || distance <= 0) {
            throw new Error("Distance is required for mileage claims");
        }

        // Load category to get mileageRate
        const category = await prisma.expenseCategory.findFirst({
            where: { id: categoryId, organizationId },
            select: { mileageRate: true },
        });

        if (!category?.mileageRate) {
            throw new Error("Mileage rate is not configured for this category");
        }

        amount = calculateMileage(distance, Number(category.mileageRate), distanceUnit || "km");
        finalCurrency = "BDT";
        exchangeRate = 1.0;
        amountInBDT = amount;
    } else if (categoryType === "per_diem") {
        // Per-diem: amount is computed from days × rate
        if (!perDiemDays || perDiemDays <= 0) {
            throw new Error("Number of days is required for per-diem claims");
        }

        const rate = perDiemRate;
        if (!rate || rate <= 0) {
            throw new Error("Per-diem rate is not configured for this category");
        }

        amount = calculatePerDiem(perDiemDays, rate);
        finalCurrency = "BDT";
        exchangeRate = 1.0;
        amountInBDT = amount;
    } else {
        // Standard: amount is user-provided, convert to BDT
        if (!userAmount || userAmount <= 0) {
            throw new Error("Amount is required for standard claims");
        }

        amount = userAmount;

        if (finalCurrency === "BDT") {
            exchangeRate = 1.0;
            amountInBDT = amount;
        } else {
            const conversion = await convertToBDT(amount, finalCurrency);
            if (!conversion) {
                throw new Error(`No exchange rate available for ${finalCurrency}. Please use BDT or contact HR to update exchange rates.`);
            }
            exchangeRate = conversion.exchangeRate;
            amountInBDT = conversion.amountInBDT;
        }
    }

    // Policy violation check
    const policyViolation = await checkExpensePolicy({
        employeeId,
        organizationId,
        categoryId,
        amountInBDT,
        receiptUrl,
        expenseDate,
        claimId,
    });

    return {
        amount: Math.round(amount * 100) / 100,
        currency: finalCurrency,
        exchangeRate,
        amountInBDT: Math.round(amountInBDT * 100) / 100,
        policyViolation,
    };
}

// ── Currency Formatting ──────────────────────────────────────────────

/**
 * Format a currency amount for display.
 * Uses the currency's symbol if known, falls back to the code.
 */
export function formatCurrency(amount: number, currency: string = "BDT"): string {
    const cur = CURRENCY_MAP.get(currency);
    const symbol = cur?.symbol || currency;

    // For BDT, use Bengali formatting style
    if (currency === "BDT") {
        return `${symbol}${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
    }

    // For other currencies, use international formatting
    return `${symbol}${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Format a currency amount with explicit BDT equivalent.
 * e.g., "$100.00 (≈ ৳11,700.00)"
 */
export function formatCurrencyWithBDT(
    amount: number,
    currency: string,
    amountInBDT: number,
): string {
    if (currency === "BDT") {
        return formatCurrency(amount, currency);
    }
    return `${formatCurrency(amount, currency)} (≈ ${formatCurrency(amountInBDT, "BDT")})`;
}
