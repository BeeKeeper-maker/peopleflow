import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function routeSource(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("tenant and RBAC guard coverage in critical API routes", () => {
  it("leave detail route scopes lookups to the authenticated organization and direct manager/self/admin access", () => {
    const source = routeSource("src/app/api/leaves/applications/[id]/route.ts");

    expect(source).toMatch(/employee:\s*\{[\s\S]*organizationId:\s*auth\.organizationId/);
    expect(source).toContain("canAccessLeave(auth, application)");
    expect(source).toContain("canApproveLeave(auth, targetApplication)");
    expect(source).toContain("application.employee.reportingManagerId === auth.employeeId");
    expect(source).toMatch(/approvalRequest[\s\S]*organizationId:\s*auth\.organizationId/);
  });

  it("expense claim detail route rejects cross-organization claims before returning data", () => {
    const source = routeSource("src/app/api/expenses/claims/[id]/route.ts");

    expect(source).toContain("claim.organizationId !== user.organizationId");
    expect(source).toContain("!canAccessClaim(user, claim)");
    expect(source).toContain("canApproveClaim(user, claim)");
    expect(source).toContain("claim.employee?.reportingManagerId === user.employee.id");
  });

  it("employee detail route scopes full and public profiles by organization", () => {
    const source = routeSource("src/app/api/employees/[id]/route.ts");

    expect(source).toMatch(/where:\s*\{[\s\S]*id,[\s\S]*organizationId:\s*user\.organizationId/);
    expect(source).toContain("reportingManagerId: user.employee.id");
    expect(source).toContain("const isSelf = user.employee?.id === id");
    expect(source).toContain("salaryAssignments");
    expect(source).toMatch(/Regular employees viewing others: public fields only/);
  });

  it("attendance history route always starts with authenticated organization scope", () => {
    const source = routeSource("src/app/api/attendance/route.ts");

    expect(source).toMatch(/employee:\s*\{[\s\S]*organizationId:\s*auth\.organizationId/);
    expect(source).toContain("requestedEmployeeId !== auth.employeeId");
    expect(source).toContain("employeeWhere.reportingManagerId = auth.employeeId");
    expect(source).toContain("reportingManagerId: auth.employeeId");
    expect(source).toContain("where.employeeId = auth.employeeId");
  });
});
