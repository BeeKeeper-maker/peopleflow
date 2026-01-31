import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { SalarySlipPDF, SalarySlipData } from "@/components/payroll/salary-slip-pdf";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        // Get salary slip
        const salarySlip = await prisma.salarySlip.findUnique({
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
        });

        if (!salarySlip || salarySlip.employee.organizationId !== user.organizationId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Check access - employee can only view their own, HR can view all
        const isHR = ["admin", "hr_admin", "super_admin"].includes(user.role);
        if (!isHR && salarySlip.employeeId !== user.employee?.id) {
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
        console.error("Error generating salary slip PDF:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
