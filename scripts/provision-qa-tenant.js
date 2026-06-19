const { PrismaClient } = require("../src/generated/prisma");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

const QA_ORG = {
  name: "PeopleFlow QA Lab",
  slug: "peopleflow-qa-lab",
};

const PASSWORD = process.env.QA_TENANT_PASSWORD || "PeopleFlowQA@2026!";
const now = () => new Date();

async function upsertUser({ email, name, role, organizationId }) {
  const password = await hash(PASSWORD, 12);
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      isActive: true,
      emailVerified: now(),
      password,
      organizationId,
    },
    create: {
      email,
      name,
      role,
      isActive: true,
      emailVerified: now(),
      password,
      organizationId,
    },
  });
}

async function upsertEmployee({ organizationId, userId, employeeCode, firstName, lastName, email, roleDesignationId, departmentId, branchId, shiftId, reportingManagerId }) {
  return prisma.employee.upsert({
    where: { organizationId_employeeCode: { organizationId, employeeCode } },
    update: {
      firstName,
      lastName,
      email,
      userId,
      employmentStatus: "active",
      departmentId,
      designationId: roleDesignationId,
      branchId,
      shiftId,
      reportingManagerId: reportingManagerId || null,
      deletedAt: null,
    },
    create: {
      organizationId,
      employeeCode,
      firstName,
      lastName,
      email,
      userId,
      joiningDate: new Date("2026-01-01T00:00:00.000Z"),
      employmentStatus: "active",
      departmentId,
      designationId: roleDesignationId,
      branchId,
      shiftId,
      reportingManagerId: reportingManagerId || null,
    },
  });
}

async function main() {
  console.log("[QA] Provisioning PeopleFlow QA Lab tenant (idempotent)...");

  const plan =
    (await prisma.plan.findUnique({ where: { slug: "growth" } })) ||
    (await prisma.plan.findUnique({ where: { slug: "starter" } }));

  if (!plan) {
    throw new Error("No starter/growth plan exists. Run runtime seed first.");
  }

  const org = await prisma.organization.upsert({
    where: { slug: QA_ORG.slug },
    update: {
      name: QA_ORG.name,
      status: "active",
      countryCode: "BD",
      currencyCode: "BDT",
      timezone: "Asia/Dhaka",
      onboardedAt: now(),
      settings: {
        purpose: "qa-only",
        emailBypass: "preverified-demo-users-only",
        weeklyOffDays: ["Friday", "Saturday"],
        dateFormat: "DD/MM/YYYY",
      },
    },
    create: {
      name: QA_ORG.name,
      slug: QA_ORG.slug,
      industry: "QA / Demo",
      employeeCountRange: "1-10",
      status: "active",
      countryCode: "BD",
      currencyCode: "BDT",
      timezone: "Asia/Dhaka",
      onboardedAt: now(),
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      settings: {
        purpose: "qa-only",
        emailBypass: "preverified-demo-users-only",
        weeklyOffDays: ["Friday", "Saturday"],
        dateFormat: "DD/MM/YYYY",
      },
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {
      status: "active",
      planId: plan.id,
      currentPeriodStart: now(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      organizationId: org.id,
      planId: plan.id,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: now(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const branch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "HQ" } },
    update: { name: "QA Head Office", isHeadOffice: true, isActive: true },
    create: { organizationId: org.id, code: "HQ", name: "QA Head Office", city: "Dhaka", isHeadOffice: true },
  });

  const department = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "OPS" } },
    update: { name: "Operations", isActive: true },
    create: { organizationId: org.id, code: "OPS", name: "Operations", nameBn: "অপারেশনস" },
  });

  const adminDesignation = await prisma.designation.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "ADMIN" } },
    update: { name: "Admin", isActive: true },
    create: { organizationId: org.id, code: "ADMIN", name: "Admin", grade: 1 },
  });
  const managerDesignation = await prisma.designation.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "MGR" } },
    update: { name: "Manager", isActive: true },
    create: { organizationId: org.id, code: "MGR", name: "Manager", grade: 2 },
  });
  const employeeDesignation = await prisma.designation.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "EXEC" } },
    update: { name: "Executive", isActive: true },
    create: { organizationId: org.id, code: "EXEC", name: "Executive", grade: 3 },
  });

  const shift = await prisma.shift.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "GEN" } },
    update: { name: "General Shift", isDefault: true, isActive: true },
    create: {
      organizationId: org.id,
      code: "GEN",
      name: "General Shift",
      nameBn: "সাধারণ শিফট",
      startTime: "09:00",
      endTime: "18:00",
      breakDuration: 60,
      graceMinutes: 15,
      isDefault: true,
    },
  });

  const adminUser = await upsertUser({
    email: "qa.admin@peopleflow.local",
    name: "QA Admin",
    role: "admin",
    organizationId: org.id,
  });
  const managerUser = await upsertUser({
    email: "qa.manager@peopleflow.local",
    name: "QA Manager",
    role: "manager",
    organizationId: org.id,
  });
  const employeeUser = await upsertUser({
    email: "qa.employee@peopleflow.local",
    name: "QA Employee",
    role: "employee",
    organizationId: org.id,
  });

  const adminEmployee = await upsertEmployee({
    organizationId: org.id,
    userId: adminUser.id,
    employeeCode: "QA-ADMIN-001",
    firstName: "QA",
    lastName: "Admin",
    email: adminUser.email,
    roleDesignationId: adminDesignation.id,
    departmentId: department.id,
    branchId: branch.id,
    shiftId: shift.id,
  });
  const managerEmployee = await upsertEmployee({
    organizationId: org.id,
    userId: managerUser.id,
    employeeCode: "QA-MGR-001",
    firstName: "QA",
    lastName: "Manager",
    email: managerUser.email,
    roleDesignationId: managerDesignation.id,
    departmentId: department.id,
    branchId: branch.id,
    shiftId: shift.id,
  });
  const employee = await upsertEmployee({
    organizationId: org.id,
    userId: employeeUser.id,
    employeeCode: "QA-EMP-001",
    firstName: "QA",
    lastName: "Employee",
    email: employeeUser.email,
    roleDesignationId: employeeDesignation.id,
    departmentId: department.id,
    branchId: branch.id,
    shiftId: shift.id,
    reportingManagerId: managerEmployee.id,
  });

  const leaveTypes = [
    { code: "AL", name: "Annual Leave", nameBn: "বার্ষিক ছুটি", color: "#3B82F6", annualAllocation: 10 },
    { code: "SL", name: "Sick Leave", nameBn: "অসুস্থতাজনিত ছুটি", color: "#EF4444", annualAllocation: 14 },
    { code: "CL", name: "Casual Leave", nameBn: "নৈমিত্তিক ছুটি", color: "#F59E0B", annualAllocation: 10 },
  ];

  for (const leaveTypeData of leaveTypes) {
    const leaveType = await prisma.leaveType.upsert({
      where: { organizationId_code: { organizationId: org.id, code: leaveTypeData.code } },
      update: { ...leaveTypeData, isActive: true },
      create: { ...leaveTypeData, organizationId: org.id },
    });

    for (const emp of [adminEmployee, managerEmployee, employee]) {
      await prisma.leaveAllocation.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: leaveType.id, year: 2026 } },
        update: { allocatedDays: leaveTypeData.annualAllocation, usedDays: 0, carriedForward: 0 },
        create: {
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          year: 2026,
          allocatedDays: leaveTypeData.annualAllocation,
        },
      });
    }
  }

  await prisma.approvalWorkflow.upsert({
    where: { organizationId_entityType: { organizationId: org.id, entityType: "leave" } },
    update: {
      name: "QA Leave Approval Workflow",
      isActive: true,
      steps: JSON.stringify([
        { step: 1, approverType: "reporting_manager", role: "manager", label: "Direct Manager" },
        { step: 2, approverType: "role", role: "admin", label: "Admin Final Approval" },
      ]),
    },
    create: {
      organizationId: org.id,
      entityType: "leave",
      name: "QA Leave Approval Workflow",
      isActive: true,
      steps: JSON.stringify([
        { step: 1, approverType: "reporting_manager", role: "manager", label: "Direct Manager" },
        { step: 2, approverType: "role", role: "admin", label: "Admin Final Approval" },
      ]),
    },
  });

  console.log("[QA] ✅ QA tenant ready");
  console.log(JSON.stringify({
    organization: { id: org.id, name: org.name, slug: org.slug },
    credentials: {
      admin: { email: adminUser.email, password: PASSWORD },
      manager: { email: managerUser.email, password: PASSWORD },
      employee: { email: employeeUser.email, password: PASSWORD },
    },
    employeeIds: {
      admin: adminEmployee.id,
      manager: managerEmployee.id,
      employee: employee.id,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[QA] ❌ Provisioning failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
