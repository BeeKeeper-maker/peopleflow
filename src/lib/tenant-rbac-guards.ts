import type { UserRole } from "@/lib/api-auth";

export type ActorContext = {
  role: UserRole | string;
  organizationId: string;
  employeeId?: string | null;
};

export type EmployeeResource = {
  id: string;
  organizationId: string;
  reportingManagerId?: string | null;
};

export type LeaveLikeResource = {
  organizationId: string;
  employeeId: string;
  reportingManagerId?: string | null;
};

export type ExpenseLikeResource = LeaveLikeResource;

export type AttendanceLikeResource = {
  organizationId: string;
  employeeId: string;
  reportingManagerId?: string | null;
};

export const HR_LEVEL_ROLES = new Set(["super_admin", "admin", "hr_admin"]);
export const MANAGER_LEVEL_ROLES = new Set(["super_admin", "admin", "hr_admin", "manager"]);

export function isSameTenant(actor: ActorContext, resource: { organizationId: string }): boolean {
  return !!actor.organizationId && actor.organizationId === resource.organizationId;
}

export function isHRLevelRole(role: string | undefined | null): boolean {
  return !!role && HR_LEVEL_ROLES.has(role);
}

export function isManagerLevelRole(role: string | undefined | null): boolean {
  return !!role && MANAGER_LEVEL_ROLES.has(role);
}

export function canViewSensitiveEmployeeProfile(actor: ActorContext, employee: EmployeeResource): boolean {
  if (!isSameTenant(actor, employee)) return false;
  if (isHRLevelRole(actor.role)) return true;
  if (actor.employeeId && employee.id === actor.employeeId) return true;
  return actor.role === "manager" && !!actor.employeeId && employee.reportingManagerId === actor.employeeId;
}

export function canViewEmployeeDirectoryRecord(actor: ActorContext, employee: EmployeeResource): boolean {
  return isSameTenant(actor, employee);
}

export function canAccessLeave(actor: ActorContext, leave: LeaveLikeResource): boolean {
  if (!isSameTenant(actor, leave)) return false;
  if (isHRLevelRole(actor.role)) return true;
  if (actor.employeeId && leave.employeeId === actor.employeeId) return true;
  return actor.role === "manager" && !!actor.employeeId && leave.reportingManagerId === actor.employeeId;
}

export function canApproveLeave(actor: ActorContext, leave: LeaveLikeResource): boolean {
  if (!isSameTenant(actor, leave)) return false;
  if (isHRLevelRole(actor.role)) return true;
  return actor.role === "manager" && !!actor.employeeId && leave.reportingManagerId === actor.employeeId;
}

export function canAccessExpenseClaim(actor: ActorContext, claim: ExpenseLikeResource): boolean {
  return canAccessLeave(actor, claim);
}

export function canApproveExpenseClaim(actor: ActorContext, claim: ExpenseLikeResource): boolean {
  return canApproveLeave(actor, claim);
}

export function canAccessAttendanceRecord(actor: ActorContext, attendance: AttendanceLikeResource): boolean {
  if (!isSameTenant(actor, attendance)) return false;
  if (isHRLevelRole(actor.role)) return true;
  if (actor.employeeId && attendance.employeeId === actor.employeeId) return true;
  return actor.role === "manager" && !!actor.employeeId && attendance.reportingManagerId === actor.employeeId;
}

export function canQueryEmployeeAttendance(actor: ActorContext, targetEmployee: EmployeeResource): boolean {
  if (!isSameTenant(actor, targetEmployee)) return false;
  if (isHRLevelRole(actor.role)) return true;
  if (actor.employeeId && targetEmployee.id === actor.employeeId) return true;
  return actor.role === "manager" && !!actor.employeeId && targetEmployee.reportingManagerId === actor.employeeId;
}
