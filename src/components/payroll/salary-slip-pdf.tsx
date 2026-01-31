"use client";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
    Font,
} from "@react-pdf/renderer";

// Register fonts (using default fonts for now)
// In production, you'd register custom Bengali fonts

interface SalarySlipData {
    employee: {
        name: string;
        employeeCode: string;
        designation: string;
        department: string;
        joiningDate: string;
        bankName?: string;
        accountNumber?: string;
    };
    organization: {
        name: string;
        address?: string;
        logoUrl?: string;
    };
    payPeriod: {
        month: string;
        year: number;
        payDate: string;
    };
    earnings: {
        basicSalary: number;
        houseRent: number;
        medicalAllowance: number;
        transportAllowance: number;
        otherAllowances: number;
        bonus?: number;
        overtime?: number;
    };
    deductions: {
        providentFund: number;
        professionalTax: number;
        incomeTax: number;
        loanDeduction?: number;
        otherDeductions: number;
    };
    summary: {
        grossEarnings: number;
        totalDeductions: number;
        netPayable: number;
    };
}

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: "Helvetica",
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: "#3B82F6",
        paddingBottom: 15,
    },
    logoSection: {
        flexDirection: "row",
        alignItems: "center",
    },
    logo: {
        width: 50,
        height: 50,
        marginRight: 10,
    },
    companyName: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1F2937",
    },
    companyAddress: {
        fontSize: 9,
        color: "#6B7280",
        marginTop: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "right",
        color: "#3B82F6",
    },
    payPeriod: {
        fontSize: 10,
        textAlign: "right",
        color: "#6B7280",
        marginTop: 4,
    },
    employeeInfo: {
        flexDirection: "row",
        backgroundColor: "#F3F4F6",
        padding: 15,
        borderRadius: 4,
        marginBottom: 20,
    },
    infoColumn: {
        flex: 1,
    },
    infoRow: {
        flexDirection: "row",
        marginBottom: 4,
    },
    infoLabel: {
        width: 90,
        color: "#6B7280",
        fontSize: 9,
    },
    infoValue: {
        flex: 1,
        fontWeight: "bold",
        color: "#1F2937",
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#1F2937",
        marginBottom: 10,
        marginTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        paddingBottom: 5,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#3B82F6",
        padding: 8,
        color: "#FFFFFF",
    },
    tableHeaderCell: {
        flex: 1,
        fontWeight: "bold",
        fontSize: 9,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        padding: 8,
    },
    tableRowAlt: {
        backgroundColor: "#F9FAFB",
    },
    tableCell: {
        flex: 1,
        fontSize: 9,
    },
    tableCellAmount: {
        flex: 1,
        textAlign: "right",
        fontSize: 9,
    },
    summarySection: {
        marginTop: 20,
        padding: 15,
        backgroundColor: "#EFF6FF",
        borderRadius: 4,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 10,
        color: "#374151",
    },
    summaryValue: {
        fontSize: 10,
        fontWeight: "bold",
    },
    netPayRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 2,
        borderTopColor: "#3B82F6",
    },
    netPayLabel: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#1F2937",
    },
    netPayValue: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#3B82F6",
    },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        paddingTop: 10,
    },
    footerText: {
        fontSize: 8,
        color: "#9CA3AF",
        textAlign: "center",
    },
    footerNote: {
        fontSize: 7,
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: 4,
    },
    twoColumn: {
        flexDirection: "row",
        gap: 20,
    },
    column: {
        flex: 1,
    },
});

function formatCurrency(amount: number): string {
    return `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;
}

export function SalarySlipPDF({ data }: { data: SalarySlipData }) {
    const earningsRows = [
        { label: "Basic Salary", amount: data.earnings.basicSalary },
        { label: "House Rent Allowance", amount: data.earnings.houseRent },
        { label: "Medical Allowance", amount: data.earnings.medicalAllowance },
        { label: "Transport Allowance", amount: data.earnings.transportAllowance },
        { label: "Other Allowances", amount: data.earnings.otherAllowances },
        ...(data.earnings.bonus ? [{ label: "Bonus", amount: data.earnings.bonus }] : []),
        ...(data.earnings.overtime ? [{ label: "Overtime", amount: data.earnings.overtime }] : []),
    ].filter(row => row.amount > 0);

    const deductionRows = [
        { label: "Provident Fund", amount: data.deductions.providentFund },
        { label: "Professional Tax", amount: data.deductions.professionalTax },
        { label: "Income Tax", amount: data.deductions.incomeTax },
        ...(data.deductions.loanDeduction ? [{ label: "Loan Deduction", amount: data.deductions.loanDeduction }] : []),
        { label: "Other Deductions", amount: data.deductions.otherDeductions },
    ].filter(row => row.amount > 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoSection}>
                        <View>
                            <Text style={styles.companyName}>{data.organization.name}</Text>
                            {data.organization.address && (
                                <Text style={styles.companyAddress}>{data.organization.address}</Text>
                            )}
                        </View>
                    </View>
                    <View>
                        <Text style={styles.title}>SALARY SLIP</Text>
                        <Text style={styles.payPeriod}>
                            {data.payPeriod.month} {data.payPeriod.year}
                        </Text>
                        <Text style={styles.payPeriod}>
                            Pay Date: {data.payPeriod.payDate}
                        </Text>
                    </View>
                </View>

                {/* Employee Info */}
                <View style={styles.employeeInfo}>
                    <View style={styles.infoColumn}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Employee Name:</Text>
                            <Text style={styles.infoValue}>{data.employee.name}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Employee ID:</Text>
                            <Text style={styles.infoValue}>{data.employee.employeeCode}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Designation:</Text>
                            <Text style={styles.infoValue}>{data.employee.designation}</Text>
                        </View>
                    </View>
                    <View style={styles.infoColumn}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Department:</Text>
                            <Text style={styles.infoValue}>{data.employee.department}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Joining Date:</Text>
                            <Text style={styles.infoValue}>{data.employee.joiningDate}</Text>
                        </View>
                        {data.employee.bankName && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Bank Account:</Text>
                                <Text style={styles.infoValue}>
                                    {data.employee.bankName} - {data.employee.accountNumber}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Earnings and Deductions */}
                <View style={styles.twoColumn}>
                    {/* Earnings */}
                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>Earnings</Text>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderCell}>Description</Text>
                            <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Amount</Text>
                        </View>
                        {earningsRows.map((row, index) => (
                            <View
                                key={row.label}
                                style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                            >
                                <Text style={styles.tableCell}>{row.label}</Text>
                                <Text style={styles.tableCellAmount}>{formatCurrency(row.amount)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Deductions */}
                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>Deductions</Text>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderCell}>Description</Text>
                            <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Amount</Text>
                        </View>
                        {deductionRows.map((row, index) => (
                            <View
                                key={row.label}
                                style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                            >
                                <Text style={styles.tableCell}>{row.label}</Text>
                                <Text style={styles.tableCellAmount}>{formatCurrency(row.amount)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Summary */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Gross Earnings</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(data.summary.grossEarnings)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Deductions</Text>
                        <Text style={[styles.summaryValue, { color: "#DC2626" }]}>
                            - {formatCurrency(data.summary.totalDeductions)}
                        </Text>
                    </View>
                    <View style={styles.netPayRow}>
                        <Text style={styles.netPayLabel}>Net Payable</Text>
                        <Text style={styles.netPayValue}>{formatCurrency(data.summary.netPayable)}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        This is a computer-generated document. No signature is required.
                    </Text>
                    <Text style={styles.footerNote}>
                        Generated by PeopleFlow HRMS on {new Date().toLocaleDateString()}
                    </Text>
                </View>
            </Page>
        </Document>
    );
}

export type { SalarySlipData };
