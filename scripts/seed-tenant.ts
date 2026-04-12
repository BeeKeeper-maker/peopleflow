/**
 * Tenant QA Setup Script
 *
 * Creates (or updates) a tenant admin user with the CPO-specified credentials
 * and ensures all 30 demo employees are linked to the tenant organization.
 *
 * Run: npx tsx scripts/seed-tenant.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🔧 PeopleFlow — Tenant QA Setup\n");

    // ── 1. Find or Create the Organization ──────────────────────────
    console.log("  📦 Looking up organization...");
    let org = await prisma.organization.findFirst({
        where: { slug: "nexatech-bd" },
    });

    if (!org) {
        console.log("  ⚠️  Organization not found. Creating...");
        org = await prisma.organization.create({
            data: {
                name: "NexaTech Solutions Ltd.",
                slug: "nexatech-bd",
                industry: "IT & RMG",
                employeeCountRange: "51-200",
                countryCode: "BD",
                currencyCode: "BDT",
                timezone: "Asia/Dhaka",
                status: "active",
                onboardedAt: new Date("2024-06-15"),
                settings: JSON.stringify({
                    locale: "en",
                    dateFormat: "DD/MM/YYYY",
                    weekStart: "sunday",
                }),
            },
        });
    }
    console.log(`  ✅ Organization: ${org.name} (${org.id})\n`);

    // ── 2. Create/Update the HR Admin User ──────────────────────────
    const EMAIL = "hr@nexatech.com";
    const PASSWORD = "Admin@2026!";
    const hashedPassword = await hash(PASSWORD, 12);

    console.log("  👤 Setting up tenant admin user...");
    const adminUser = await prisma.user.upsert({
        where: { email: EMAIL },
        update: {
            password: hashedPassword,
            role: "admin",
            isActive: true,
            organizationId: org.id,
            name: "Nusrat Jahan (HR Director)",
            emailVerified: new Date(),
        },
        create: {
            email: EMAIL,
            name: "Nusrat Jahan (HR Director)",
            password: hashedPassword,
            role: "admin",
            isActive: true,
            emailVerified: new Date(),
            organizationId: org.id,
        },
    });
    console.log(`  ✅ Admin: ${adminUser.email} (${adminUser.id})\n`);

    // ── 3. Also create a Super Admin user ───────────────────────────
    const superPassword = await hash(PASSWORD, 12);
    const superUser = await prisma.user.upsert({
        where: { email: "admin@nexatech.com.bd" },
        update: {
            password: superPassword,
            role: "super_admin",
            isActive: true,
            organizationId: org.id,
            emailVerified: new Date(),
        },
        create: {
            email: "admin@nexatech.com.bd",
            name: "Farhan Rahman (CEO)",
            password: superPassword,
            role: "super_admin",
            isActive: true,
            emailVerified: new Date(),
            organizationId: org.id,
        },
    });
    console.log(`  ✅ Super Admin: ${superUser.email}\n`);

    // ── 4. Verify employees are linked ──────────────────────────────
    const employeeCount = await prisma.employee.count({
        where: { organizationId: org.id },
    });
    console.log(`  📊 Employees linked to ${org.name}: ${employeeCount}`);

    if (employeeCount === 0) {
        console.log("  ⚠️  No employees found! Run 'npx tsx scripts/seed-employees.ts' first.");
    } else {
        // Link admin user to the HR Director employee (EMP-002)
        const hrEmployee = await prisma.employee.findFirst({
            where: { organizationId: org.id, employeeCode: "EMP-002" },
        });
        if (hrEmployee) {
            await prisma.employee.update({
                where: { id: hrEmployee.id },
                data: { userId: adminUser.id },
            });
            console.log(`  🔗 Linked ${adminUser.email} → ${hrEmployee.firstName} ${hrEmployee.lastName} (${hrEmployee.employeeCode})`);
        }
        console.log(`  ✅ All ${employeeCount} employees ready.\n`);
    }

    // ── 5. Summary ──────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════");
    console.log("  🎉 TENANT QA ENVIRONMENT READY");
    console.log("═══════════════════════════════════════════════════");
    console.log("");
    console.log("  🔑 Tenant Login:");
    console.log(`     URL:      http://localhost:3000/login`);
    console.log(`     Email:    ${EMAIL}`);
    console.log(`     Password: ${PASSWORD}`);
    console.log("");
    console.log("  🔑 Platform Admin Login:");
    console.log(`     URL:      http://localhost:3000/platform/login`);
    console.log(`     Email:    platform@peopleflow.app`);
    console.log(`     Password: PlatformAdmin@2026!`);
    console.log("");
    console.log(`  📊 Organization: ${org.name}`);
    console.log(`  👥 Employees: ${employeeCount}`);
    console.log("═══════════════════════════════════════════════════\n");
}

main()
    .catch((err) => {
        console.error("❌ Setup failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
