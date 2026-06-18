import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

type ReadinessStatus = "ready" | "attention" | "optional";

type ReadinessItem = {
  id: string;
  title: string;
  description: string;
  status: ReadinessStatus;
  count?: number;
  target?: number;
  fixHref: string;
  fixLabel: string;
  detail?: string;
};

function item(input: ReadinessItem): ReadinessItem {
  return input;
}

function parseWorkflowSteps(steps: string | null | undefined) {
  if (!steps) return [];
  try {
    const parsed = JSON.parse(steps);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await auth.withDB(async (db) => {
      const [
        organization,
        branches,
        departments,
        designations,
        activeUsers,
        activeAdmins,
        activeHrAdmins,
        activeManagerUsers,
        activeEmployees,
        essLinkedEmployees,
        employeesMissingManagers,
        leaveTypes,
        leaveWorkflow,
        devices,
        devicesWithSerial,
        employeesWithBiometricId,
        recentCloudEvents,
        recentBiometricAttendance,
        activeCompensationAssignments,
      ] = await Promise.all([
        db.organization.findUnique({
          where: { id: auth.organizationId },
          select: { id: true, name: true, slug: true, timezone: true, countryCode: true, currencyCode: true, status: true },
        }),
        db.branch.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.department.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.designation.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.user.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.user.count({ where: { organizationId: auth.organizationId, isActive: true, role: { in: ["super_admin", "admin"] } } }),
        db.user.count({ where: { organizationId: auth.organizationId, isActive: true, role: "hr_admin" } }),
        db.user.count({ where: { organizationId: auth.organizationId, isActive: true, role: "manager", employee: { isNot: null } } }),
        db.employee.count({ where: { organizationId: auth.organizationId, employmentStatus: "active", deletedAt: null } }),
        db.employee.count({ where: { organizationId: auth.organizationId, employmentStatus: "active", deletedAt: null, userId: { not: null } } }),
        db.employee.count({ where: { organizationId: auth.organizationId, employmentStatus: "active", deletedAt: null, reportingManagerId: null } }),
        db.leaveType.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.approvalWorkflow.findUnique({
          where: { organizationId_entityType: { organizationId: auth.organizationId, entityType: "leave" } },
          select: { id: true, isActive: true, steps: true, updatedAt: true },
        }),
        db.biometricDevice.count({ where: { organizationId: auth.organizationId, isActive: true } }),
        db.biometricDevice.count({ where: { organizationId: auth.organizationId, isActive: true, serialNumber: { not: null } } }),
        db.employee.count({ where: { organizationId: auth.organizationId, employmentStatus: "active", deletedAt: null, biometricUserId: { not: null } } }),
        db.biometricCloudEvent.count({
          where: {
            organizationId: auth.organizationId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        db.attendance.count({
          where: {
            source: "biometric",
            employee: { organizationId: auth.organizationId },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        db.salaryStructureAssignment.findMany({
          where: {
            isActive: true,
            grossSalary: { gt: 0 },
            employee: { organizationId: auth.organizationId, employmentStatus: "active", deletedAt: null },
          },
          select: { employeeId: true },
          distinct: ["employeeId"],
        }),
      ]);

      const workflowSteps = parseWorkflowSteps(leaveWorkflow?.steps);
      const profileReady = Boolean(organization?.name && organization?.slug && organization?.timezone && organization?.countryCode && organization?.currencyCode);
      const approvalReady = Boolean(leaveWorkflow?.isActive && workflowSteps.length > 0);
      const employeesNeedingManagers = Math.max(employeesMissingManagers - activeAdmins, 0);
      const employeesWithActiveCompensation = activeCompensationAssignments.length;
      const employeesMissingCompensation = Math.max(activeEmployees - employeesWithActiveCompensation, 0);

      const items: ReadinessItem[] = [
        item({
          id: "organization-profile",
          title: "Organization profile",
          description: "Company identity, timezone, country, and currency are needed before payroll, attendance, and reports feel official.",
          status: profileReady ? "ready" : "attention",
          fixHref: "/settings",
          fixLabel: "Review settings",
          detail: organization ? `${organization.name} · ${organization.timezone} · ${organization.currencyCode}` : "Organization record was not found.",
        }),
        item({
          id: "branches",
          title: "Branches",
          description: "At least one active branch is required so employees and biometric devices can be mapped to a real office.",
          status: branches > 0 ? "ready" : "attention",
          count: branches,
          target: 1,
          fixHref: "/organization/branches",
          fixLabel: "Configure branches",
        }),
        item({
          id: "departments",
          title: "Departments",
          description: "Departments keep reporting, access review, and HR filtering organized.",
          status: departments > 0 ? "ready" : "attention",
          count: departments,
          target: 1,
          fixHref: "/departments",
          fixLabel: "Configure departments",
        }),
        item({
          id: "designations",
          title: "Designations",
          description: "Designations make employee profiles and approval context clear for admins and managers.",
          status: designations > 0 ? "ready" : "attention",
          count: designations,
          target: 1,
          fixHref: "/designations",
          fixLabel: "Configure designations",
        }),
        item({
          id: "admin-access",
          title: "Admin / HR access",
          description: "The office needs active admin and HR owners before handover, otherwise support will bottleneck on one login.",
          status: activeAdmins > 0 && activeHrAdmins > 0 ? "ready" : "attention",
          count: activeAdmins + activeHrAdmins,
          target: 2,
          fixHref: "/settings/access",
          fixLabel: "Review access",
          detail: `${activeAdmins} admin, ${activeHrAdmins} HR admin, ${activeUsers} active users`,
        }),
        item({
          id: "manager-access",
          title: "Managers assigned",
          description: "Manager users should be active and linked to employee profiles before leave approvals go live.",
          status: activeManagerUsers > 0 ? "ready" : "attention",
          count: activeManagerUsers,
          target: 1,
          fixHref: "/settings/access",
          fixLabel: "Assign managers",
        }),
        item({
          id: "employee-ess",
          title: "ESS login links",
          description: "Employees who need self-service should be linked to user accounts through their employee profile email.",
          status: activeEmployees === 0 ? "optional" : essLinkedEmployees > 0 ? "ready" : "attention",
          count: essLinkedEmployees,
          target: activeEmployees,
          fixHref: "/employees",
          fixLabel: "Review employees",
          detail: `${essLinkedEmployees}/${activeEmployees} active employees linked to login users`,
        }),
        item({
          id: "reporting-managers",
          title: "Reporting managers",
          description: "Approval routes need reporting managers for normal employees; otherwise leave requests may fall back to admin handling.",
          status: activeEmployees === 0 ? "optional" : employeesNeedingManagers === 0 ? "ready" : "attention",
          count: Math.max(activeEmployees - employeesNeedingManagers, 0),
          target: activeEmployees,
          fixHref: "/employees",
          fixLabel: "Map reporting managers",
          detail: employeesNeedingManagers > 0 ? `${employeesNeedingManagers} active employee(s) still need reporting manager mapping` : "Reporting manager mapping looks clean",
        }),
        item({
          id: "compensation-setup",
          title: "Compensation setup",
          description: "Employees can be onboarded without salary, but payroll, payslips, PF, bonus, and salary certificates require active compensation first.",
          status: activeEmployees === 0 ? "optional" : employeesMissingCompensation === 0 ? "ready" : "attention",
          count: employeesWithActiveCompensation,
          target: activeEmployees,
          fixHref: "/payroll",
          fixLabel: "Assign compensation",
          detail: employeesMissingCompensation > 0 ? `${employeesMissingCompensation} active employee(s) have deferred compensation and will be excluded from payroll` : "All active employees have active compensation",
        }),
        item({
          id: "leave-types",
          title: "Leave types",
          description: "Leave balances and applications require active leave types such as annual, casual, sick, or earned leave.",
          status: leaveTypes > 0 ? "ready" : "attention",
          count: leaveTypes,
          target: 1,
          fixHref: "/leaves/types",
          fixLabel: "Configure leave types",
        }),
        item({
          id: "leave-workflow",
          title: "Leave approval workflow",
          description: "A live leave workflow confirms who approves requests and in what order.",
          status: approvalReady ? "ready" : "attention",
          count: workflowSteps.length,
          target: 1,
          fixHref: "/approval-workflows",
          fixLabel: "Review workflow",
          detail: leaveWorkflow ? `${leaveWorkflow.isActive ? "Active" : "Inactive"} · ${workflowSteps.length} step(s)` : "No leave workflow configured",
        }),
        item({
          id: "biometric-devices",
          title: "Biometric devices",
          description: "Device records should include serial numbers for direct-cloud attendance capture and troubleshooting.",
          status: devices === 0 ? "optional" : devicesWithSerial === devices ? "ready" : "attention",
          count: devicesWithSerial,
          target: devices,
          fixHref: "/devices",
          fixLabel: "Review devices",
          detail: `${devices} active device(s), ${devicesWithSerial} with serial numbers`,
        }),
        item({
          id: "biometric-mapping",
          title: "Biometric ID mapping",
          description: "Employees who use fingerprint attendance must have biometric user IDs matching the physical device user ID.",
          status: devices === 0 ? "optional" : employeesWithBiometricId > 0 ? "ready" : "attention",
          count: employeesWithBiometricId,
          target: activeEmployees,
          fixHref: "/employees",
          fixLabel: "Map biometric IDs",
          detail: `${employeesWithBiometricId}/${activeEmployees} active employees have biometric IDs`,
        }),
        item({
          id: "recent-device-activity",
          title: "Recent device activity",
          description: "Recent cloud events or biometric attendance prove the office device path is alive.",
          status: devices === 0 ? "optional" : recentCloudEvents > 0 || recentBiometricAttendance > 0 ? "ready" : "attention",
          count: recentCloudEvents + recentBiometricAttendance,
          target: 1,
          fixHref: "/devices/events",
          fixLabel: "Open event center",
          detail: `${recentCloudEvents} cloud event(s), ${recentBiometricAttendance} biometric attendance record(s) in last 7 days`,
        }),
      ];

      const summary = {
        total: items.length,
        ready: items.filter((check) => check.status === "ready").length,
        attention: items.filter((check) => check.status === "attention").length,
        optional: items.filter((check) => check.status === "optional").length,
        score: Math.round((items.filter((check) => check.status === "ready").length / items.length) * 100),
      };

      return {
        organization: organization ? { name: organization.name, status: organization.status, timezone: organization.timezone } : null,
        summary,
        items,
        generatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    apiLogger.error({ err: error }, "SETUP_READINESS_GET_ERROR");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
