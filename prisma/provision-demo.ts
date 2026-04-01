import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // ── Discover existing state ──
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true, slug: true, status: true },
    });
    console.log("=== ORGANIZATIONS ===");
    console.log(JSON.stringify(orgs, null, 2));

    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, organizationId: true },
        take: 5,
    });
    console.log("\n=== USERS (first 5) ===");
    console.log(JSON.stringify(users, null, 2));

    const subs = await prisma.subscription.findMany({
        select: { id: true, organizationId: true, planId: true, status: true },
    });
    console.log("\n=== SUBSCRIPTIONS ===");
    console.log(JSON.stringify(subs, null, 2));

    const admins = await prisma.platformAdmin.findMany({
        select: { id: true, email: true, name: true, role: true },
    });
    console.log("\n=== PLATFORM ADMINS ===");
    console.log(JSON.stringify(admins, null, 2));

    // ── Provision Demo Tenant if none exist ──
    if (orgs.length === 0) {
        console.log("\n🏗️  No tenants found. Provisioning Demo Tenant...");

        const growthPlan = await prisma.plan.findFirst({ where: { slug: "growth" } });
        if (!growthPlan) {
            console.error("❌ No Growth plan found. Run seed-plans.ts first.");
            return;
        }

        const hashedPassword = await hash("DemoAdmin@2026!", 12);

        const org = await prisma.organization.create({
            data: {
                name: "Acme Corporation",
                slug: "acme",
                status: "active",
                timezone: "Asia/Dhaka",
                currencyCode: "BDT",
                settings: {
                    dateFormat: "DD/MM/YYYY",
                },
            },
        });

        const user = await prisma.user.create({
            data: {
                email: "admin@acme.demo",
                name: "Demo Admin",
                password: hashedPassword,
                role: "admin",
                organizationId: org.id,
                isActive: true,
            },
        });

        const subscription = await prisma.subscription.create({
            data: {
                organizationId: org.id,
                planId: growthPlan.id,
                status: "active",
                billingCycle: "monthly",
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        // Add sample employees (simple — no designation relation required)
        const employees = [
            { firstName: "Rafiq", lastName: "Ahmed", email: "rafiq@acme.demo", employeeCode: "ACME-1001" },
            { firstName: "Nusrat", lastName: "Jahan", email: "nusrat@acme.demo", employeeCode: "ACME-1002" },
            { firstName: "Kamal", lastName: "Hossain", email: "kamal@acme.demo", employeeCode: "ACME-1003" },
        ];

        for (const emp of employees) {
            await prisma.employee.create({
                data: {
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    email: emp.email,
                    employeeCode: emp.employeeCode,
                    organizationId: org.id,
                    joiningDate: new Date("2025-06-01"),
                    employmentStatus: "active",
                },
            });
        }

        console.log(`\n✅ Demo Tenant Provisioned:`);
        console.log(`   Organization: ${org.name} (${org.slug})`);
        console.log(`   Admin Email:  admin@acme.demo`);
        console.log(`   Admin Pass:   DemoAdmin@2026!`);
        console.log(`   Plan: Growth (${growthPlan.priceMonthly} BDT/mo)`);
        console.log(`   Subscription: ${subscription.status}`);
        console.log(`   Employees: ${employees.length} provisioned`);
    } else {
        console.log("\n✅ Tenants already exist. Skipping provisioning.");
        if (users.length > 0) {
            console.log(`   First tenant user: ${users[0].email}`);
        }
    }

    await prisma.$disconnect();
}

main().catch(console.error);
