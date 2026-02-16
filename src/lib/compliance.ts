/**
 * PeopleFlow Bangladesh Labor Law Compliance Engine
 *
 * Validates payroll, working hours, leave entitlements, and benefits
 * against Bangladesh Labor Act 2006 (and amendments).
 *
 * ✅ Audit fixes applied:
 *  - Gratuity formula now consistent with payroll-engine.ts (30 days × years)
 *  - Added weekly holiday validation (Section 103)
 *  - Added notice period validation (Section 26)
 */

// ============================================
// Minimum Wage by Industry Sector
// (Bangladesh Minimum Wage Board, latest gazette)
// ============================================

const MINIMUM_WAGES: Record<string, number> = {
    rmg: 12500,        // Ready-Made Garments (Grade 7)
    tannery: 13500,
    pharmaceuticals: 11000,
    jute: 9300,
    tea: 5200,
    shrimp: 10200,
    it_ites: 15000,    // Custom — no gazette, industry standard
    banking: 20000,    // Custom — industry standard
    general: 10000,    // Default minimum
};

export interface ComplianceResult {
    isCompliant: boolean;
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
}

export interface ComplianceViolation {
    code: string;
    severity: "critical" | "high" | "medium";
    description: string;
    reference: string; // Labor Act section
    recommendation: string;
}

export interface ComplianceWarning {
    code: string;
    description: string;
    recommendation: string;
}

// ============================================
// Minimum Wage Validation
// ============================================

export function validateMinimumWage(
    monthlyGross: number,
    industrySector: string = "general"
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };
    const minWage = MINIMUM_WAGES[industrySector.toLowerCase()] || MINIMUM_WAGES.general;

    if (monthlyGross < minWage) {
        result.isCompliant = false;
        result.violations.push({
            code: "MW-001",
            severity: "critical",
            description: `Monthly gross salary (${monthlyGross} BDT) is below minimum wage (${minWage} BDT) for ${industrySector} sector.`,
            reference: "Bangladesh Labor Act 2006, Section 149",
            recommendation: `Increase gross salary to at least ${minWage} BDT.`,
        });
    }

    return result;
}

// ============================================
// Overtime Compliance
// ============================================

/**
 * Bangladesh Labor Act, Section 100-102:
 * - Normal working hours: 8 hours/day, 48 hours/week
 * - Maximum with overtime: 10 hours/day, 60 hours/week
 * - Overtime rate: 2x basic hourly rate
 */
export function validateOvertime(
    dailyHours: number,
    weeklyHours: number,
    overtimeRate: number,
    basicHourlyRate: number
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };

    if (dailyHours > 10) {
        result.isCompliant = false;
        result.violations.push({
            code: "OT-001",
            severity: "high",
            description: `Daily working hours (${dailyHours}h) exceed maximum 10 hours.`,
            reference: "Bangladesh Labor Act 2006, Section 100",
            recommendation: "Reduce daily hours to no more than 10 hours (8 normal + 2 overtime).",
        });
    }

    if (weeklyHours > 60) {
        result.isCompliant = false;
        result.violations.push({
            code: "OT-002",
            severity: "high",
            description: `Weekly working hours (${weeklyHours}h) exceed maximum 60 hours.`,
            reference: "Bangladesh Labor Act 2006, Section 102",
            recommendation: "Ensure weekly hours do not exceed 60 hours including overtime.",
        });
    }

    const minOTRate = basicHourlyRate * 2;
    if (overtimeRate > 0 && overtimeRate < minOTRate) {
        result.isCompliant = false;
        result.violations.push({
            code: "OT-003",
            severity: "critical",
            description: `Overtime rate (${overtimeRate} BDT/hr) is below legally mandated 2x rate (${minOTRate} BDT/hr).`,
            reference: "Bangladesh Labor Act 2006, Section 108",
            recommendation: `Set overtime rate to at least ${minOTRate} BDT/hr (2x basic rate).`,
        });
    }

    if (dailyHours > 8 && dailyHours <= 10) {
        result.warnings.push({
            code: "OT-W001",
            description: `Employee working ${dailyHours} hours (${dailyHours - 8}h overtime). Monitor for sustained overtime.`,
            recommendation: "Review workload distribution to minimize regular overtime.",
        });
    }

    return result;
}

// ============================================
// Gratuity Compliance
// ============================================

/**
 * ✅ FIXED: Consistent with payroll-engine.ts
 * 
 * Bangladesh Labor Act 2006, Section 27:
 * - Gratuity is payable after 5 years of continuous service
 * - Amount: 30 days' wages for each completed year of service
 * - Daily wage = lastBasicSalary / 26
 */
export function calculateGratuity(
    lastBasicSalary: number,
    yearsOfService: number
): { eligible: boolean; amount: number; basis: string } {
    if (yearsOfService < 5) {
        return {
            eligible: false,
            amount: 0,
            basis: "Not eligible — requires minimum 5 years of continuous service (Section 27, BLA 2006)",
        };
    }

    // ✅ 30 days wages × years of service (daily wage = basic / 26 working days)
    const dailyWage = lastBasicSalary / 26;
    const gratuityAmount = Math.round(dailyWage * 30 * yearsOfService);

    return {
        eligible: true,
        amount: gratuityAmount,
        basis: `30 days' wages (${Math.round(dailyWage * 30)} BDT) × ${yearsOfService} years = ${gratuityAmount} BDT (Section 27, BLA 2006)`,
    };
}

// ============================================
// Festival Bonus Compliance
// ============================================

/**
 * Bangladesh standard practice (not legally mandated but industry standard):
 * - 2 festival bonuses per year (Eid-ul-Fitr and Eid-ul-Adha)
 * - Each bonus = 1 month basic salary (minimum)
 */
export function calculateFestivalBonus(
    basicSalary: number,
    bonusPercentage: number = 100 // Percentage of basic
): { amount: number; total: number } {
    const perBonus = Math.round(basicSalary * (bonusPercentage / 100));
    return {
        amount: perBonus,
        total: perBonus * 2, // 2 Eids per year
    };
}

// ============================================
// PF Contribution Validation
// ============================================

/**
 * Provident Fund:
 * - Employee contribution: minimum 10% of basic
 * - Equal employer contribution
 */
export function validatePFContribution(
    employeeContribution: number,
    employerContribution: number,
    basicSalary: number
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };
    const minContribution = basicSalary * 0.10;

    if (employeeContribution < minContribution) {
        result.warnings.push({
            code: "PF-W001",
            description: `Employee PF contribution (${employeeContribution} BDT) is below recommended 10% of basic (${Math.round(minContribution)} BDT).`,
            recommendation: "Consider setting PF to at least 10% of basic salary.",
        });
    }

    if (employerContribution < employeeContribution) {
        result.violations.push({
            code: "PF-001",
            severity: "medium",
            description: `Employer PF contribution (${employerContribution} BDT) is less than employee contribution (${employeeContribution} BDT).`,
            reference: "Provident Fund Act, Section 5",
            recommendation: "Employer contribution must be at least equal to employee contribution.",
        });
        result.isCompliant = false;
    }

    return result;
}

// ============================================
// Leave Entitlement Validation
// ============================================

/**
 * Bangladesh Labor Act 2006, Section 115-118:
 * - Annual Leave: 1 day per 18 working days (minimum ~14 days/year)
 * - Casual Leave: 10 days/year
 * - Sick Leave: 14 days/year  
 * - Maternity Leave: 8 weeks before + 8 weeks after delivery (16 weeks total)
 */
export function validateLeaveEntitlement(
    annualLeave: number,
    casualLeave: number,
    sickLeave: number,
    maternityLeave?: number
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };

    if (annualLeave < 14) {
        result.isCompliant = false;
        result.violations.push({
            code: "LV-001",
            severity: "high",
            description: `Annual leave (${annualLeave} days) is below legally mandated minimum (14 days).`,
            reference: "Bangladesh Labor Act 2006, Section 117",
            recommendation: "Set annual leave to at least 14 days per year.",
        });
    }

    if (casualLeave < 10) {
        result.isCompliant = false;
        result.violations.push({
            code: "LV-002",
            severity: "high",
            description: `Casual leave (${casualLeave} days) is below legally mandated minimum (10 days).`,
            reference: "Bangladesh Labor Act 2006, Section 115",
            recommendation: "Set casual leave to at least 10 days per year.",
        });
    }

    if (sickLeave < 14) {
        result.isCompliant = false;
        result.violations.push({
            code: "LV-003",
            severity: "high",
            description: `Sick leave (${sickLeave} days) is below legally mandated minimum (14 days).`,
            reference: "Bangladesh Labor Act 2006, Section 116",
            recommendation: "Set sick leave to at least 14 days per year.",
        });
    }

    if (maternityLeave !== undefined && maternityLeave < 112) { // 16 weeks = 112 days
        result.isCompliant = false;
        result.violations.push({
            code: "LV-004",
            severity: "critical",
            description: `Maternity leave (${maternityLeave} days) is below legally mandated minimum (112 days / 16 weeks).`,
            reference: "Bangladesh Labor Act 2006, Section 46-47",
            recommendation: "Set maternity leave to at least 112 days (16 weeks).",
        });
    }

    return result;
}

// ============================================
// ✅ NEW: Weekly Holiday Validation
// ============================================

/**
 * Bangladesh Labor Act 2006, Section 103:
 * Every worker must get at least one day off per week.
 */
export function validateWeeklyHoliday(
    daysWorkedInWeek: number
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };

    if (daysWorkedInWeek > 6) {
        result.isCompliant = false;
        result.violations.push({
            code: "WH-001",
            severity: "high",
            description: `Employee worked ${daysWorkedInWeek} days without a rest day.`,
            reference: "Bangladesh Labor Act 2006, Section 103",
            recommendation: "Ensure at least 1 rest day per week.",
        });
    }

    return result;
}

// ============================================
// ✅ NEW: Notice Period Validation
// ============================================

/**
 * Bangladesh Labor Act 2006, Section 26:
 * - Permanent workers: 120 days notice (or pay in lieu)
 * - Temporary workers: 60 days notice
 * - Probation: 0 days (can be terminated without notice)
 */
export function validateNoticePeriod(
    noticeDays: number,
    employmentType: "permanent" | "temporary" | "probation"
): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };

    const minimums: Record<string, number> = {
        permanent: 120,
        temporary: 60,
        probation: 0,
    };

    const required = minimums[employmentType] ?? 120;

    if (noticeDays < required) {
        result.isCompliant = false;
        result.violations.push({
            code: "NP-001",
            severity: "high",
            description: `Notice period (${noticeDays} days) is below minimum (${required} days) for ${employmentType} employees.`,
            reference: "Bangladesh Labor Act 2006, Section 26",
            recommendation: `Set notice period to at least ${required} days for ${employmentType} employees.`,
        });
    }

    return result;
}

// ============================================
// Full Compliance Audit
// ============================================

export function runFullComplianceAudit(params: {
    monthlyGross: number;
    basicSalary: number;
    industrySector?: string;
    pfEmployee: number;
    pfEmployer: number;
    annualLeave: number;
    casualLeave: number;
    sickLeave: number;
    maternityLeave?: number;
    yearsOfService: number;
}): ComplianceResult {
    const result: ComplianceResult = { isCompliant: true, violations: [], warnings: [] };

    // Run all checks
    const checks = [
        validateMinimumWage(params.monthlyGross, params.industrySector),
        validatePFContribution(params.pfEmployee, params.pfEmployer, params.basicSalary),
        validateLeaveEntitlement(
            params.annualLeave,
            params.casualLeave,
            params.sickLeave,
            params.maternityLeave
        ),
    ];

    for (const check of checks) {
        if (!check.isCompliant) result.isCompliant = false;
        result.violations.push(...check.violations);
        result.warnings.push(...check.warnings);
    }

    // Gratuity check
    if (params.yearsOfService >= 5) {
        result.warnings.push({
            code: "GR-W001",
            description: `Employee has ${params.yearsOfService} years of service and is eligible for gratuity upon separation.`,
            recommendation: "Ensure gratuity liability is provisioned in financial records.",
        });
    }

    return result;
}
