"use client";

import { EmployeeDocumentVault } from "@/components/documents/employee-document-vault";

interface DocumentsTabProps {
  employee: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    employeeCode?: string | null;
  };
}

export function DocumentsTab({ employee }: DocumentsTabProps) {
  const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.employeeCode || "Employee";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <EmployeeDocumentVault employeeId={employee.id} employeeName={employeeName} compact />
    </div>
  );
}
