/**
 * Platform Admin: Employee Directory (Server Component)
 *
 * Fetches all employees across all tenants for the platform admin view.
 * Uses the shared EmployeeDirectory component with platform-specific config.
 */

import { prisma } from "@/lib/prisma";
import { EmployeeDirectory } from "@/components/employees/employee-directory";
import type { DirectoryEmployee, DirectoryDepartment } from "@/components/employees/employee-directory";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ org?: string }>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
    const params = await searchParams;

    // Get all organizations for the org filter
    const organizations = await prisma.organization.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
    });

    // Default to first org if none selected
    const selectedOrgId = params.org || organizations[0]?.id;

    // Fetch employees for the selected organization
    const employees = selectedOrgId
        ? await prisma.employee.findMany({
              where: {
                  organizationId: selectedOrgId,
                  deletedAt: null,
              },
              include: {
                  department: { select: { id: true, name: true, code: true } },
                  designation: { select: { id: true, name: true, grade: true } },
                  branch: { select: { id: true, name: true } },
                  reportingManager: {
                      select: { id: true, firstName: true, lastName: true, photoUrl: true },
                  },
              },
              orderBy: { firstName: "asc" },
          })
        : [];

    // Get departments for filter dropdown
    const departments: DirectoryDepartment[] = selectedOrgId
        ? await prisma.department.findMany({
              where: { organizationId: selectedOrgId, isActive: true },
              select: { id: true, name: true, code: true },
              orderBy: { name: "asc" },
          })
        : [];

    // Stats
    const stats = {
        total: employees.length,
        active: employees.filter((e) => e.employmentStatus === "active").length,
        onProbation: employees.filter((e) => e.employmentType === "probation").length,
        departments: departments.length,
    };

    // Serialize for client component
    const serializedEmployees: DirectoryEmployee[] = employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        gender: e.gender,
        photoUrl: e.photoUrl,
        joiningDate: e.joiningDate.toISOString(),
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        department: e.department ? { name: e.department.name, code: e.department.code } : null,
        designation: e.designation ? { name: e.designation.name, grade: e.designation.grade } : null,
        branch: e.branch ? { name: e.branch.name } : null,
        manager: e.reportingManager
            ? {
                  name: `${e.reportingManager.firstName} ${e.reportingManager.lastName}`,
                  photo: e.reportingManager.photoUrl,
              }
            : null,
    }));

    return (
        <EmployeeDirectory
            employees={serializedEmployees}
            departments={departments}
            stats={stats}
            config={{
                profileBasePath: "/platform/employees",
                organizations,
                selectedOrgId: selectedOrgId || "",
                title: "Employee Directory",
                subtitle: "Browse and manage employees across your organization",
            }}
        />
    );
}
