/**
 * PeopleFlow Digital Disbursement Engine
 *
 * Handles salary disbursements via 3 channels:
 *   - bank_transfer: Traditional EFT (no API call, just records the intent)
 *   - bkash: bKash Personal Disbursement API
 *   - nagad: Nagad Disbursement API (coming soon — placeholder)
 *
 * bKash API flow (Personal Disbursement):
 *   1. Organization registers with bKash for merchant disbursement
 *   2. Credentials stored in Organization.settings (encrypted)
 *   3. HR selects "Disburse via bKash" on approved salary slips
 *   4. Engine calls bKash API with amount + employee bKash number
 *   5. bKash returns transaction ID → stored as reference
 *   6. Status polled/confirmed → success/failed
 *
 * Security:
 *   - bKash credentials are NEVER stored in plaintext — encrypted at rest
 *   - API calls are made server-side only (credentials never reach client)
 *   - All disbursements are audit-logged
 *   - Failed disbursements can be retried
 *
 * Bangladesh-specific:
 *   - bKash is the most popular mobile wallet (50M+ users)
 *   - Many factory/RMG workers don't have bank accounts but have bKash
 *   - Nagad is the government-backed alternative (growing rapidly)
 *   - This feature gives PeopleFlow a unique advantage over competitors
 */

import { prisma } from "@/lib/prisma";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";
import { decrypt, isEncrypted } from "@/lib/crypto";
import { toNumber } from "@/lib/payroll-engine";
import { decryptPii } from "@/lib/pii";

export type DisbursementChannel = "bank_transfer" | "bkash" | "nagad";
export type DisbursementStatus = "pending" | "processing" | "success" | "failed" | "refunded";

export interface DisbursementResult {
    success: boolean;
    reference?: string;
    errorMessage?: string;
    providerResponse?: Record<string, unknown>;
}

export interface BatchDisbursementResult {
    total: number;
    success: number;
    failed: number;
    results: Array<{
        slipId: string;
        employeeName: string;
        amount: number;
        channel: string;
        success: boolean;
        reference?: string;
        error?: string;
    }>;
}

// ── bKash API Configuration ──────────────────────────────────────────

interface BkashConfig {
    baseUrl: string;      // https://tokenized.pay.bka.sh/v1.2.0-beta
    username: string;
    password: string;
    appKey: string;
    appSecret: string;
}

/**
 * Extract bKash config from organization settings.
 * Credentials are stored encrypted in Organization.settings.bkashConfig.
 * Each sensitive field (username, password, appKey, appSecret) is
 * individually encrypted with AES-256-GCM.
 */
function getBkashConfig(orgSettings: unknown): BkashConfig | null {
    const settings = (orgSettings && typeof orgSettings === "object" ? orgSettings : {}) as Record<string, unknown>;
    const bkash = settings.bkashConfig as Record<string, unknown> | undefined;
    if (!bkash?.username || !bkash?.password || !bkash?.appKey || !bkash?.appSecret) {
        return null;
    }

    // Decrypt sensitive fields (backward compat: if not encrypted, use as-is)
    const decryptField = (value: unknown): string => {
        const str = value as string;
        if (!str) return "";
        try {
            // If the value looks encrypted, decrypt it
            if (isEncrypted(str)) {
                return decrypt(str);
            }
            // Backward compat: plaintext (will be encrypted on next save)
            return str;
        } catch (err) {
            payrollLogger.error({ err }, "Failed to decrypt bKash credential field");
            return str; // Fallback to plaintext (shouldn't happen in production)
        }
    };

    return {
        baseUrl: (bkash.baseUrl as string) || "https://tokenized.pay.bka.sh/v1.2.0-beta",
        username: decryptField(bkash.username),
        password: decryptField(bkash.password),
        appKey: decryptField(bkash.appKey),
        appSecret: decryptField(bkash.appSecret),
    };
}

// ── bKash Token ──────────────────────────────────────────────────────

/**
 * SECURITY: The bKash token cache is keyed by organization ID.
 *
 * Previously this was a single module-level variable shared across all
 * tenants, which meant Tenant A's bKash token could be (incorrectly) used
 * to authorize a disbursement for Tenant B. Because bKash tokens encode
 * the merchant credentials used to mint them, this could let Tenant B
 * accidentally (or maliciously) draw funds from Tenant A's bKash wallet.
 *
 * Keying by organizationId guarantees that each tenant's token cache is
 * isolated, and that a token minted with Tenant A's credentials can never
 * be presented on a request for Tenant B.
 */
const bkashTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getBkashToken(
    config: BkashConfig,
    organizationId: string,
): Promise<string> {
    // Check cache (token valid for ~1 hour, we refresh at 50 min).
    // Refresh slightly earlier (1 minute buffer) to avoid edge-case expiry.
    const cached = bkashTokenCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
        return cached.token;
    }

    const response = await fetch(`${config.baseUrl}/tokenized/checkout/token/grant`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            username: config.username,
            password: config.password,
        },
        body: JSON.stringify({
            app_key: config.appKey,
            app_secret: config.appSecret,
        }),
    });

    const data = await response.json();

    if (data.statusCode !== "0000") {
        throw new Error(`bKash token failed: ${data.statusMessage}`);
    }

    const token = data.idToken;
    bkashTokenCache.set(organizationId, {
        token,
        expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes
    });

    return token;
}

// ── bKash Disbursement ───────────────────────────────────────────────

/**
 * Disburse salary to an employee's bKash account.
 *
 * bKash Personal Disbursement API:
 *   POST /tokenized/checkout/payment/b2c
 *
 * Required:
 *   - amount: BDT amount (e.g., 35000.50)
 *   - receiver: employee's bKash account number (01XXXXXXXXX)
 *
 * Returns:
 *   - success: true/false
 *   - reference: bKash transaction ID (trnxID)
 *   - providerResponse: full API response
 *
 * P17-BUGS-8: The caller MUST pass `salarySlipId` and `disbursementId` so
 * the merchantInvoiceNumber is deterministic and traceable back to a slip.
 * The amount is rounded to 2 decimal places (bKash rejects >2 dp amounts).
 */
async function disburseViaBkash(
    config: BkashConfig,
    amount: number,
    receiverMsisdn: string,
    organizationId: string,
    salarySlipId: string,
    disbursementId: string,
): Promise<DisbursementResult> {
    try {
        const token = await getBkashToken(config, organizationId);

        // P17-BUGS-8a: bKash rejects amounts with more than 2 decimal places
        // (e.g. 1234.56789 → 4001 BadRequest). Our payroll engine rounds to
        // integer BDT, but downstream adjustments (partial-day payroll,
        // prorated festival bonus, fractional arrears) can produce sub-poisha
        // amounts. Round here as the last line of defense before the API call.
        const roundedAmount = Math.round(amount * 100) / 100;

        // P17-BUGS-8b: Use a deterministic merchantInvoiceNumber so HR can
        // match a bKash transaction back to a salary slip for reconciliation.
        // The previous implementation used `PF-${Date.now()}-${Math.random()}`
        // which made matching impossible. The new format encodes:
        //   - slipId: HR can search the bKash merchant portal by slip id.
        //   - disbursementId: ensures uniqueness per attempt. A failed
        //     disbursement that is retried creates a NEW SalaryDisbursement
        //     row, so this id differs across attempts and bKash does NOT
        //     reject the retry as a duplicate.
        const merchantInvoiceNumber = `PF-${salarySlipId}-${disbursementId}`;

        const response = await fetch(`${config.baseUrl}/tokenized/checkout/payment/b2c`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                Authorization: token,
                "X-APP-Key": config.appKey,
            },
            body: JSON.stringify({
                amount: String(roundedAmount),
                currency: "BDT",
                receiverMSISDN: receiverMsisdn,
                merchantInvoiceNumber,
            }),
        });

        const data = await response.json();

        if (data.statusCode === "0000" && data.transactionStatus === "Completed") {
            return {
                success: true,
                reference: data.trnxID || data.b2cTrnxID,
                providerResponse: data,
            };
        } else if (data.statusCode === "0000" && data.transactionStatus === "Pending") {
            // Pending — needs status check later
            return {
                success: false,
                reference: data.trnxID,
                errorMessage: "Transaction pending — status check required",
                providerResponse: data,
            };
        } else {
            return {
                success: false,
                errorMessage: data.statusMessage || "bKash disbursement failed",
                providerResponse: data,
            };
        }
    } catch (error) {
        return {
            success: false,
            errorMessage: error instanceof Error ? error.message : "Network error calling bKash API",
        };
    }
}

// ── Nagad Disbursement (placeholder — API not yet public) ────────────

async function disburseViaNagad(
    _config: unknown,
    _amount: number,
    _receiver: string,
): Promise<DisbursementResult> {
    // Nagad's disbursement API is not yet publicly documented.
    // When it becomes available, implement here following the same pattern as bKash.
    // For now, return an informative error.
    return {
        success: false,
        errorMessage: "Nagad disbursement API is not yet available. Please use bKash or bank transfer.",
    };
}

// ── Main Disbursement Function ───────────────────────────────────────

/**
 * Disburse a single salary slip via the specified channel.
 *
 * Creates a SalaryDisbursement record, calls the provider API,
 * and updates the slip status to "paid" on success.
 *
 * @param salarySlipId  The salary slip to disburse
 * @param channel        bank_transfer | bkash | nagad
 * @param organizationId  The org (for credentials lookup)
 * @param actorUserId    The user initiating the disbursement (for audit)
 */
export async function disburseSalary(params: {
    salarySlipId: string;
    channel: DisbursementChannel;
    organizationId: string;
    actorUserId: string;
}): Promise<DisbursementResult> {
    const { salarySlipId, channel, organizationId, actorUserId } = params;

    // Load slip + employee (Organization has no direct relation to SalarySlip,
    // so we load org settings separately)
    const slip = await prisma.salarySlip.findFirst({
        where: { id: salarySlipId, employee: { organizationId } },
        include: {
            employee: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
    });

    if (!slip) {
        return { success: false, errorMessage: "Salary slip not found" };
    }

    // Load org settings separately
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });

    if (slip.status !== "approved" && slip.status !== "paid") {
        return { success: false, errorMessage: `Slip status is ${slip.status}. Only approved slips can be disbursed.` };
    }

    if (slip.isLocked) {
        return { success: false, errorMessage: "Slip is locked. Unlock first." };
    }

    // Phase 1 (Float → Decimal): slip.netSalary is now Prisma.Decimal. The
    // disbursement functions, SalaryDisbursement.amount (Float column), and the
    // audit log all expect a native number. Coerce here once at the read site.
    const amount = toNumber(slip.netSalary);

    // Create pending disbursement record
    const disbursement = await prisma.salaryDisbursement.create({
        data: {
            amount,
            channel,
            status: "processing",
            salarySlipId: slip.id,
            employeeId: slip.employee.id,
            organizationId,
        },
    });

    let result: DisbursementResult;

    if (channel === "bank_transfer") {
        // Bank transfer doesn't call an API — it just records the intent.
        // HR will manually process the bank file.
        result = {
            success: true,
            reference: `BANK-${Date.now()}`,
        };
    } else if (channel === "bkash") {
        const config = getBkashConfig(org?.settings);
        if (!config) {
            result = {
                success: false,
                errorMessage: "bKash is not configured for this organization. Please set up bKash credentials in Settings.",
            };
        } else {
            // Get employee's bKash number.
            // Lookup order (most-trusted first):
            //   1. Employee.bkashNumber — the dedicated column (encrypted at rest since P6-DECIMAL-PII).
            //   2. customFields.bkashNumber — legacy escape hatch used by older UI flows.
            //   3. Employee.phone — last-resort fallback (assuming the worker uses their
            //      personal phone as their bKash number, which is common for RMG workers).
            const employeeWithPhone = await prisma.employee.findUnique({
                where: { id: slip.employee.id },
                select: { phone: true, customFields: true, bkashNumber: true },
            });

            const bkashNumber =
                decryptPii(employeeWithPhone?.bkashNumber) ||
                (employeeWithPhone?.customFields as Record<string, unknown>)?.bkashNumber as string ||
                employeeWithPhone?.phone?.replace(/[^0-9]/g, "") ||
                "";

            if (!bkashNumber) {
                result = {
                    success: false,
                    errorMessage: "Employee does not have a bKash number. Please add it to the employee profile.",
                };
            } else {
                result = await disburseViaBkash(
                    config,
                    amount,
                    bkashNumber,
                    organizationId,
                    slip.id,
                    disbursement.id,
                );
            }
        }
    } else if (channel === "nagad") {
        result = await disburseViaNagad(null, amount, "");
    } else {
        result = { success: false, errorMessage: `Unknown channel: ${channel}` };
    }

    // Update disbursement record
    await prisma.salaryDisbursement.update({
        where: { id: disbursement.id },
        data: {
            status: result.success ? "success" : "failed",
            reference: result.reference || null,
            providerResponse: result.providerResponse as object || undefined,
            errorMessage: result.errorMessage || null,
            processedAt: new Date(),
        },
    });

    // If successful, mark the salary slip as paid
    if (result.success) {
        await prisma.salarySlip.update({
            where: { id: slip.id },
            data: {
                status: "paid",
                paymentDate: new Date(),
                paymentMode: channel,
                transactionRef: result.reference || null,
            },
        });
    }

    // Audit log
    await createAuditLog({
        organizationId,
        action: "create",
        entityType: "SalaryDisbursement",
        entityId: disbursement.id,
        newValues: {
            channel,
            amount,
            slipId: slip.id,
            employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
            success: result.success,
            reference: result.reference,
        },
        userId: actorUserId,
    }).catch((err) => payrollLogger.error({ err }, "Audit log failed for disbursement"));

    payrollLogger.info(
        { slipId: salarySlipId, channel, amount, success: result.success, reference: result.reference },
        "Salary disbursement processed",
    );

    return result;
}

/**
 * Batch disburse multiple salary slips via the same channel.
 *
 * Processes each slip sequentially (bKash API has rate limits).
 * Returns a summary of success/failure counts.
 */
export async function batchDisburseSalary(params: {
    slipIds: string[];
    channel: DisbursementChannel;
    organizationId: string;
    actorUserId: string;
}): Promise<BatchDisbursementResult> {
    const { slipIds, channel, organizationId, actorUserId } = params;

    const results: BatchDisbursementResult["results"] = [];
    let success = 0;
    let failed = 0;

    for (const slipId of slipIds) {
        const slip = await prisma.salarySlip.findFirst({
            where: { id: slipId, employee: { organizationId } },
            include: {
                employee: { select: { firstName: true, lastName: true } },
            },
        });

        if (!slip) {
            results.push({
                slipId,
                employeeName: "Unknown",
                amount: 0,
                channel,
                success: false,
                error: "Slip not found",
            });
            failed++;
            continue;
        }

        // Skip already-paid slips
        if (slip.status === "paid") {
            results.push({
                slipId,
                employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
                amount: toNumber(slip.netSalary),
                channel,
                success: true,
                reference: "Already paid",
            });
            success++;
            continue;
        }

        const result = await disburseSalary({
            salarySlipId: slipId,
            channel,
            organizationId,
            actorUserId,
        });

        results.push({
            slipId,
            employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
            amount: toNumber(slip.netSalary),
            channel,
            success: result.success,
            reference: result.reference,
            error: result.errorMessage,
        });

        if (result.success) success++;
        else failed++;

        // Small delay between bKash API calls (rate limit safety)
        if (channel === "bkash") {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    payrollLogger.info(
        { channel, total: slipIds.length, success, failed },
        "Batch disbursement complete",
    );

    return { total: slipIds.length, success, failed, results };
}
