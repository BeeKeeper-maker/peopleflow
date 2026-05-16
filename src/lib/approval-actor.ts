import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/api-auth";

const ADMIN_APPROVER_ROLES = new Set(["super_admin", "admin", "hr_admin"]);

function nameFromEmail(email: string) {
  const local = email.split("@")[0] || "admin";
  const parts = local.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : "Admin",
    lastName: parts.slice(1).join(" ") || "Approver",
  };
}

async function createApproverProfile(auth: AuthContext) {
  const { firstName, lastName } = nameFromEmail(auth.email);
  const baseCode = `ADM-${auth.userId.slice(-6).toUpperCase()}`;

  for (let i = 0; i < 3; i += 1) {
    const employeeCode = i === 0 ? baseCode : `${baseCode}-${i + 1}`;
    try {
      return await prisma.employee.create({
        data: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          employeeCode,
          firstName,
          lastName,
          email: auth.email,
          joiningDate: new Date(),
          employmentType: "permanent",
          employmentStatus: "active",
          customFields: {
            systemGeneratedApprover: true,
            reason: "Created automatically so admin/HR approval actions have a valid audit actor.",
          },
        },
        select: { id: true },
      });
    } catch (error) {
      if (i === 2) throw error;
    }
  }

  throw new Error("Unable to create approver profile");
}

export async function resolveApprovalActorEmployee(auth: AuthContext): Promise<{ id: string } | null> {
  if (auth.employeeId) return { id: auth.employeeId };

  const existing = await prisma.employee.findFirst({
    where: { userId: auth.userId, organizationId: auth.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing;

  if (!ADMIN_APPROVER_ROLES.has(auth.role)) return null;

  return createApproverProfile(auth);
}
