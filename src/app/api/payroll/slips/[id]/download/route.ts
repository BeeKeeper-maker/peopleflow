import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { SalarySlipPDF, SalarySlipData } from "@/components/payroll/salary-slip-pdf";
import { payrollLogger } from "@/lib/logger";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        // Get salary slip (RLS-scoped via auth.withDB)
        const salarySlip = await auth.withDB((db) => db.salarySlip.findUnique({
            where: { id },
            include: {
                employee: {
                    include: {
                        department: true,
                        designation: true,
                        organization: true,
                    },
                },
            },
        }));

        if (!salarySlip || salarySlip.employee.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Check access - employee can only view their own, HR can view all
        const isHR = ["admin", "hr_admin", "super_admin"].includes(auth.role);
        if (!isHR && salarySlip.employeeId !== auth.employeeId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Map salary slip fields to PDF data
        const earnings = {
            basicSalary: salarySlip.basicSalary,
            houseRent: salarySlip.houseRent,
            medicalAllowance: salarySlip.medicalAllowance,
            transportAllowance: salarySlip.conveyance,
            otherAllowances: salarySlip.specialAllowance + salarySlip.otherEarnings,
            bonus: salarySlip.bonus || undefined,
            overtime: salarySlip.overtime || undefined,
        };

        const deductions = {
            providentFund: salarySlip.pfEmployee,
            professionalTax: 0,
            incomeTax: salarySlip.incomeTax,
            loanDeduction: salarySlip.loanDeduction || undefined,
            otherDeductions: salarySlip.advanceDeduction + salarySlip.absentDeduction + salarySlip.lateDeduction + salarySlip.otherDeductions,
        };

        // Get month name
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[salarySlip.month - 1] || "Unknown";

        // Prepare data for PDF
        const pdfData: SalarySlipData = {
            employee: {
                name: `${salarySlip.employee.firstName} ${salarySlip.employee.lastName}`,
                employeeCode: salarySlip.employee.employeeCode,
                designation: salarySlip.employee.designation?.name || "N/A",
                department: salarySlip.employee.department?.name || "N/A",
                joiningDate: new Date(salarySlip.employee.joiningDate).toLocaleDateString(),
                bankName: salarySlip.employee.bankName || undefined,
                accountNumber: salarySlip.employee.accountNumber || undefined,
            },
            organization: {
                name: salarySlip.employee.organization.name,
            },
            payPeriod: {
                month: monthName,
                year: salarySlip.year,
                payDate: salarySlip.paymentDate
                    ? new Date(salarySlip.paymentDate).toLocaleDateString()
                    : "Pending",
            },
            earnings,
            deductions,
            summary: {
                grossEarnings: salarySlip.grossSalary,
                totalDeductions: salarySlip.totalDeductions,
                netPayable: salarySlip.netSalary,
            },
        };

        // Generate PDF
        const pdfBuffer = await renderToBuffer(SalarySlipPDF({ data: pdfData }));

        // Return PDF
        const filename = `salary-slip-${salarySlip.employee.employeeCode}-${monthName}-${salarySlip.year}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "Error generating salary slip PDF:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
