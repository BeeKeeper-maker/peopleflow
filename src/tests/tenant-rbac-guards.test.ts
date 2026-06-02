import { describe, expect, it } from "vitest";
import {
  canAccessAttendanceRecord,
  canAccessExpenseClaim,
  canAccessLeave,
  canApproveExpenseClaim,
  canApproveLeave,
  canQueryEmployeeAttendance,
  canViewEmployeeDirectoryRecord,
  canViewSensitiveEmployeeProfile,
  isSameTenant,
  type ActorContext,
} from "@/lib/tenant-rbac-guards";
import { canAccessRoute, hasPermission } from "@/lib/permissions";

const ORG_A = "org-a";
const ORG_B = "org-b";

const adminA: ActorContext = { role: "admin", organizationId: ORG_A, employeeId: "admin-emp" };
const hrA: ActorContext = { role: "hr_admin", organizationId: ORG_A, employeeId: "hr-emp" };
const managerA: ActorContext = { role: "manager", organizationId: ORG_A, employeeId: "mgr-a" };
const employeeA: ActorContext = { role: "employee", organizationId: ORG_A, employeeId: "emp-a" };
const employeeNoProfile: ActorContext = { role: "employee", organizationId: ORG_A };

const selfEmployee = { id: "emp-a", organizationId: ORG_A, reportingManagerId: "mgr-a" };
const directReport = { id: "emp-report", organizationId: ORG_A, reportingManagerId: "mgr-a" };
const otherEmployee = { id: "emp-other", organizationId: ORG_A, reportingManagerId: "mgr-other" };
const otherTenantEmployee = { id: "emp-b", organizationId: ORG_B, reportingManagerId: "mgr-a" };

describe("tenant isolation guardrail", () => {
  it("requires exact organization match before any role privilege is considered", () => {
    expect(isSameTenant(adminA, selfEmployee)).toBe(true);
    expect(isSameTenant(adminA, otherTenantEmployee)).toBe(false);

    expect(canViewSensitiveEmployeeProfile(adminA, otherTenantEmployee)).toBe(false);
    expect(canAccessLeave(adminA, { organizationId: ORG_B, employeeId: "emp-b" })).toBe(false);
    expect(canAccessAttendanceRecord(adminA, { organizationId: ORG_B, employeeId: "emp-b" })).toBe(false);
  });

  it("lets HR/admin view sensitive employee profiles only inside their tenant", () => {
    expect(canViewSensitiveEmployeeProfile(adminA, otherEmployee)).toBe(true);
    expect(canViewSensitiveEmployeeProfile(hrA, otherEmployee)).toBe(true);
    expect(canViewSensitiveEmployeeProfile(hrA, otherTenantEmployee)).toBe(false);
  });

  it("lets employees view their own sensitive profile but not another employee's", () => {
    expect(canViewSensitiveEmployeeProfile(employeeA, selfEmployee)).toBe(true);
    expect(canViewSensitiveEmployeeProfile(employeeA, otherEmployee)).toBe(false);
    expect(canViewSensitiveEmployeeProfile(employeeNoProfile, selfEmployee)).toBe(false);
  });

  it("lets managers view direct-report sensitive data but not unrelated employees", () => {
    expect(canViewSensitiveEmployeeProfile(managerA, directReport)).toBe(true);
    expect(canViewSensitiveEmployeeProfile(managerA, otherEmployee)).toBe(false);
    expect(canViewSensitiveEmployeeProfile(managerA, otherTenantEmployee)).toBe(false);
  });

  it("allows directory-level employee record visibility only inside the same tenant", () => {
    expect(canViewEmployeeDirectoryRecord(employeeA, otherEmployee)).toBe(true);
    expect(canViewEmployeeDirectoryRecord(employeeA, otherTenantEmployee)).toBe(false);
  });
});

describe("leave and expense RBAC guardrail", () => {
  const selfLeave = { organizationId: ORG_A, employeeId: "emp-a", reportingManagerId: "mgr-a" };
  const reportLeave = { organizationId: ORG_A, employeeId: "emp-report", reportingManagerId: "mgr-a" };
  const unrelatedLeave = { organizationId: ORG_A, employeeId: "emp-other", reportingManagerId: "mgr-other" };
  const crossTenantLeave = { organizationId: ORG_B, employeeId: "emp-b", reportingManagerId: "mgr-a" };

  it("lets employees access only their own leave/expense records", () => {
    expect(canAccessLeave(employeeA, selfLeave)).toBe(true);
    expect(canAccessLeave(employeeA, unrelatedLeave)).toBe(false);
    expect(canAccessExpenseClaim(employeeA, selfLeave)).toBe(true);
    expect(canAccessExpenseClaim(employeeA, unrelatedLeave)).toBe(false);
  });

  it("lets managers access/approve direct-report requests only", () => {
    expect(canAccessLeave(managerA, reportLeave)).toBe(true);
    expect(canApproveLeave(managerA, reportLeave)).toBe(true);
    expect(canAccessLeave(managerA, unrelatedLeave)).toBe(false);
    expect(canApproveLeave(managerA, unrelatedLeave)).toBe(false);

    expect(canAccessExpenseClaim(managerA, reportLeave)).toBe(true);
    expect(canApproveExpenseClaim(managerA, reportLeave)).toBe(true);
  });

  it("lets HR/admin approve same-tenant requests but never cross-tenant requests", () => {
    expect(canApproveLeave(adminA, unrelatedLeave)).toBe(true);
    expect(canApproveLeave(adminA, crossTenantLeave)).toBe(false);
    expect(canApproveExpenseClaim(hrA, unrelatedLeave)).toBe(true);
    expect(canApproveExpenseClaim(hrA, crossTenantLeave)).toBe(false);
  });
});

describe("attendance RBAC guardrail", () => {
  it("keeps attendance access scoped to same tenant, self, HR, or direct report", () => {
    const selfAttendance = { organizationId: ORG_A, employeeId: "emp-a", reportingManagerId: "mgr-a" };
    const reportAttendance = { organizationId: ORG_A, employeeId: "emp-report", reportingManagerId: "mgr-a" };
    const unrelatedAttendance = { organizationId: ORG_A, employeeId: "emp-other", reportingManagerId: "mgr-other" };
    const crossTenantAttendance = { organizationId: ORG_B, employeeId: "emp-b", reportingManagerId: "mgr-a" };

    expect(canAccessAttendanceRecord(employeeA, selfAttendance)).toBe(true);
    expect(canAccessAttendanceRecord(employeeA, unrelatedAttendance)).toBe(false);
    expect(canAccessAttendanceRecord(managerA, reportAttendance)).toBe(true);
    expect(canAccessAttendanceRecord(managerA, unrelatedAttendance)).toBe(false);
    expect(canAccessAttendanceRecord(adminA, unrelatedAttendance)).toBe(true);
    expect(canAccessAttendanceRecord(adminA, crossTenantAttendance)).toBe(false);
  });

  it("uses the same guard for employee-specific attendance queries", () => {
    expect(canQueryEmployeeAttendance(managerA, directReport)).toBe(true);
    expect(canQueryEmployeeAttendance(managerA, otherEmployee)).toBe(false);
    expect(canQueryEmployeeAttendance(employeeA, selfEmployee)).toBe(true);
    expect(canQueryEmployeeAttendance(employeeA, directReport)).toBe(false);
    expect(canQueryEmployeeAttendance(adminA, otherTenantEmployee)).toBe(false);
  });
});

describe("route and permission RBAC matrix", () => {
  it("blocks employee role from admin/HR route groups", () => {
    expect(canAccessRoute("employee", "/employees")).toBe(false);
    expect(canAccessRoute("employee", "/payroll")).toBe(false);
    expect(canAccessRoute("employee", "/settings")).toBe(false);
    expect(canAccessRoute("employee", "/ess/dashboard")).toBe(true);
  });

  it("keeps manager route access narrower than HR/admin", () => {
    expect(canAccessRoute("manager", "/manager/team")).toBe(true);
    expect(canAccessRoute("manager", "/employees")).toBe(false);
    expect(canAccessRoute("manager", "/payroll/process")).toBe(false);
  });

  it("keeps sensitive payroll/admin permissions away from manager and employee roles", () => {
    expect(hasPermission("admin", "payroll:process")).toBe(true);
    expect(hasPermission("hr_admin", "payroll:process")).toBe(true);
    expect(hasPermission("manager", "payroll:process")).toBe(false);
    expect(hasPermission("employee", "payroll:view")).toBe(false);
    expect(hasPermission("employee", "payslip:view:self")).toBe(true);
  });
});
