/**
 * PeopleFlow Final Settlement Engine
 *
 * Calculates full & final settlement when an employee resigns, retires,
 * or is terminated. Per BLA 2006 Section 23-27.
 *
 * Components:
 *   1. Unpaid salary (up to last working day)
 *   2. Pro-rated earned leave encashment
 *   3. Gratuity (if eligible: 5+ years service, or termination)
 *   4. Notice pay (if notice not served, per Section 26)
 *   5. PF balance (full withdrawal on separation)
 *   6. Festival bonus pro-rata (if separation before festival)
 *   7. Pending expense reimbursements
 *   8. Outstanding loan deductions (remaining balance deducted)
 *
 * References:
 *   - BLA 2006 Section 23: Full and final settlement
 *   - BLA 2006 Section 26: Notice period
 *   - BLA 2006 Section 27: Gratuity
 *   - BLA 2006 Section 100: Leave encashment
 *
 * P0-BACKEND fix: pro-rated salary now uses ACTUAL working days
 * (excluding weekends + holidays) instead of raw calendar day-of-month,
 * so employees leaving mid-month are paid for the days they actually
 * worked, not for calendar days.
 */

import { prisma } from "@/lib/prisma";
import { payrollLogger } from "@/lib/logger";
import { calculateWorkingDays, getWeekendDays, fetchHolidays } from "@/lib/leave-utils";

export interface FinalSettlementInput {
    employeeId: string;
    lastWorkingDate: Date;
    separationType: "resignation" | "termination" | "retirement" | "death" | "dismissal";
    noticeGiven: boolean; // Did employee/employer give proper notice?
    noticeDaysServed: number; // Days of notice actually served
}

export interface FinalSettlementResult {
    employee: {
        id: string;
        name: string;
        employeeCode: string;
        joiningDate: Date;
        yearsOfService: number;
    };
    components: SettlementComponent[];
    totalPayable: number;
    totalDeductible: number;
    netPayable: number;
    calculationDate: Date;
    warnings: string[];
}

export interface SettlementComponent {
    label: string;
    labelBn?: string;
    amount: number;
    type: "payable" | "deductible";
    reference?: string; // BLA section
    details?: string;
}

/**
 * Calculate full & final settlement for a separating employee.
 */
export async function calculateFinalSettlement(
    input: FinalSettlementInput
): Promise<FinalSettlementResult> {
    const { employeeId, lastWorkingDate, separationType, noticeGiven, noticeDaysServed } = input;

    // ── 1. Fetch employee data ──
    const employee = await prisma.employee.findFirst({
        where: { id: employeeId, deletedAt: null },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            joiningDate: true,
            gender: true,
            employmentType: true,
            employmentStatus: true,
            organizationId: true,
        },
    });

    if (!employee) {
        throw new Error("Employee not found");
    }

    // ── 2. Fetch salary structure ──
    const salaryAssignment = await prisma.salaryStructureAssignment.findFirst({
        where: { employeeId, isActive: true, deletedAt: null },
        include: {
            salaryStructure: true,
        },
    });

    const monthlyBasic = salaryAssignment?.grossSalary
        ? (Number(salaryAssignment.salaryStructure.basicPercentage) / 100) * Number(salaryAssignment.grossSalary)
        : 0;
    const monthlyGross = salaryAssignment?.grossSalary ? Number(salaryAssignment.grossSalary) : 0;

    // ── 3. Calculate years of service ──
    const joiningDate = new Date(employee.joiningDate);
    const yearsOfService = Math.floor(
        (lastWorkingDate.getTime() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    const components: SettlementComponent[] = [];
    const warnings: string[] = [];

    // ── 4. Unpaid salary (pro-rated for partial month) ──
    // Use ACTUAL working days (excluding weekends + holidays) — not raw
    // calendar day-of-month. The old formula used `lastWorkingDate.getDate()`
    // which treated every calendar day as a payable day; an employee leaving
    // on the 5th (a Friday) would be paid for 5 days even though only 3 were
    // working days. This caused over-payment to separating employees.
    const monthStart = new Date(lastWorkingDate.getFullYear(), lastWorkingDate.getMonth(), 1);
    const monthEnd = new Date(lastWorkingDate.getFullYear(), lastWorkingDate.getMonth() + 1, 0);

    // Fetch organization settings + holiday list for the separation month.
    // Falls back to BD defaults (Fri/Sat weekend, no holidays) when missing.
    const org = await prisma.organization.findUnique({
        where: { id: employee.organizationId },
        select: { settings: true },
    });
    const weekendDays = getWeekendDays(org?.settings);
    const holidays = await fetchHolidays(prisma, employee.organizationId, lastWorkingDate.getFullYear());

    const workingDaysEmployed = calculateWorkingDays(monthStart, lastWorkingDate, holidays, weekendDays);
    const workingDaysInMonth = calculateWorkingDays(monthStart, monthEnd, holidays, weekendDays);

    // Guard against division-by-zero (e.g. month is entirely holidays/weekends)
    const proRatedSalary = workingDaysInMonth > 0
        ? Math.round((monthlyGross * workingDaysEmployed) / workingDaysInMonth)
        : 0;

    components.push({
        label: "Pro-rated Salary",
        labelBn: "অনুপাতিক বেতন",
        amount: proRatedSalary,
        type: "payable",
        reference: "BLA 2006 Section 23",
        details: `${workingDaysEmployed}/${workingDaysInMonth} working days of ৳${monthlyGross.toLocaleString()} BDT gross`,
    });

    // ── 5. Earned leave encashment ──
    const currentYear = lastWorkingDate.getFullYear();
    const leaveAllocations = await prisma.leaveAllocation.findMany({
        where: {
            employeeId,
            year: currentYear,
        },
        include: {
            leaveType: true,
        },
    });

    for (const alloc of leaveAllocations) {
        if (alloc.leaveType.encashmentAllowed) {
            const remainingDays = alloc.allocatedDays + alloc.carriedForward - alloc.usedDays;
            if (remainingDays > 0) {
                // Encashment = remaining days × daily basic
                const dailyBasic = monthlyBasic / 26; // 26 working days per month
                const encashmentAmount = Math.round(remainingDays * dailyBasic);

                components.push({
                    label: `${alloc.leaveType.name} Encashment`,
                    labelBn: `${alloc.leaveType.nameBn || alloc.leaveType.name} নগদায়ন`,
                    amount: encashmentAmount,
                    type: "payable",
                    reference: "BLA 2006 Section 100",
                    details: `${remainingDays} days × ৳${Math.round(dailyBasic)}/day`,
                });
            }
        }
    }

    // ── 6. Gratuity (Section 27) ──
    // Eligible: 5+ years of service (or any length if terminated/retired/death)
    const gratuityEligible =
        yearsOfService >= 5 ||
        separationType === "termination" ||
        separationType === "retirement" ||
        separationType === "death";

    if (gratuityEligible && monthlyBasic > 0) {
        // Formula: (last basic × 30 days × years of service) / 26
        const gratuityAmount = Math.round((monthlyBasic * 30 * yearsOfService) / 26);

        components.push({
            label: "Gratuity",
            labelBn: "চাকরি সহায়ক আর্থিক সুবিধা",
            amount: gratuityAmount,
            type: "payable",
            reference: "BLA 2006 Section 27",
            details: `(৳${Math.round(monthlyBasic)} × 30 × ${yearsOfService} years) / 26 days`,
        });
    } else if (yearsOfService < 5 && separationType === "resignation") {
        warnings.push(
            `Gratuity not eligible: ${yearsOfService} years of service (minimum 5 years required for resignation per Section 27)`
        );
    }

    // ── 7. Notice pay (Section 26) ──
    // Permanent: 120 days notice (or pay in lieu)
    // If notice not given/served, employer pays or employee forfeits
    const requiredNoticeDays = employee.employmentType === "permanent" ? 120 : 60;
    const shortFallDays = Math.max(0, requiredNoticeDays - noticeDaysServed);

    if (shortFallDays > 0 && monthlyBasic > 0) {
        if (separationType === "resignation") {
            // Employee didn't serve full notice → deduct from settlement
            const noticePayDeduction = Math.round((monthlyBasic * shortFallDays) / 30);
            components.push({
                label: "Notice Pay Recovery (Short Notice)",
                labelBn: "নোটিশ পে কর্তন (সংক্ষিপ্ত নোটিশ)",
                amount: noticePayDeduction,
                type: "deductible",
                reference: "BLA 2006 Section 26",
                details: `${shortFallDays} days short of ${requiredNoticeDays}-day notice requirement`,
            });
        } else if (separationType === "termination") {
            // Employer terminated without notice → pay in lieu
            const noticePay = Math.round((monthlyBasic * shortFallDays) / 30);
            components.push({
                label: "Notice Pay (Pay in Lieu)",
                labelBn: "নোটিশ পে (প্রতিস্থাপন)",
                amount: noticePay,
                type: "payable",
                reference: "BLA 2006 Section 26",
                details: `${shortFallDays} days × ৳${Math.round(monthlyBasic / 30)}/day`,
            });
        }
    }

    // ── 8. PF balance (full withdrawal on separation) ──
    const pfAccount = await prisma.pFAccount.findFirst({
        where: { employeeId, deletedAt: null },
        include: {
            transactions: {
                where: { transactionType: { in: ["employee_contribution", "employer_contribution", "interest_credit"] } },
            },
        },
    });

    if (pfAccount) {
        const pfBalance = pfAccount.transactions.reduce(
            (sum, tx) => sum + Number(tx.amount), 0
        );
        if (pfBalance > 0) {
            components.push({
                label: "PF Balance Withdrawal",
                labelBn: "পিএফ ব্যালেন্স প্রত্যাহার",
                amount: Math.round(pfBalance),
                type: "payable",
                reference: "PF Rules",
                details: `Full PF balance (employee + employer + interest)`,
            });
        }
    }

    // ── 9. Outstanding loan balance ──
    const activeLoans = await prisma.loan.findMany({
        where: {
            employeeId,
            status: "disbursed",
            remainingAmount: { gt: 0 },
        },
    });

    for (const loan of activeLoans) {
        components.push({
            label: `Loan Recovery (Loan ${loan.type || ""})`,
            labelBn: "ঋণ পরিশোধ",
            amount: Math.round(Number(loan.remainingAmount)),
            type: "deductible",
            details: `Outstanding loan balance recovered from settlement`,
        });
    }

    // ── 10. Calculate totals ──
    const totalPayable = components
        .filter(c => c.type === "payable")
        .reduce((sum, c) => sum + c.amount, 0);

    const totalDeductible = components
        .filter(c => c.type === "deductible")
        .reduce((sum, c) => sum + c.amount, 0);

    const netPayable = totalPayable - totalDeductible;

    payrollLogger.info(
        {
            employeeId,
            separationType,
            yearsOfService,
            totalPayable,
            totalDeductible,
            netPayable,
        },
        "Final settlement calculated"
    );

    return {
        employee: {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode,
            joiningDate,
            yearsOfService,
        },
        components,
        totalPayable,
        totalDeductible,
        netPayable,
        calculationDate: new Date(),
        warnings,
    };
}
