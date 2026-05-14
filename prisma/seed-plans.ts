/**
 * Plan Seeder — Seed the initial SaaS pricing plans
 *
 * Run: npx tsx prisma/seed-plans.ts
 *
 * Creates Starter, Growth, and Enterprise plans with:
 * - Resource limits (employees, admins, branches, devices, storage)
 * - Feature flags (which modules are enabled per plan)
 * - Pricing (BDT — Bangladeshi Taka)
 *
 * This also seeds a default Platform Admin account.
 */

import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding SaaS plans and platform admin...\n");

    // ============================================
    // 1. SEED PLANS
    // ============================================

    const plans = [
        {
            name: "Starter",
            slug: "starter",
            description:
                "Perfect for small teams getting started with HR management.",
            priceMonthly: 299900, // ৳2,999/month (in poisha)
            priceYearly: 2999900, // ৳29,999/year (2 months free)
            currency: "BDT",
            maxEmployees: 25,
            maxAdmins: 2,
            maxBranches: 1,
            maxDevices: 0,
            maxStorageMB: 500,
            features: {
                payroll: true,
                recruitment: false,
                performance: false,
                expenses: false,
                loans: false,
                biometric: false,
                apiAccess: false,
                customDocuments: false,
                advancedReports: false,
                compliance: false,
            },
            sortOrder: 1,
        },
        {
            name: "Growth",
            slug: "growth",
            description:
                "For growing businesses that need full HR capabilities.",
            priceMonthly: 699900, // ৳6,999/month
            priceYearly: 6999900, // ৳69,999/year
            currency: "BDT",
            maxEmployees: 100,
            maxAdmins: 5,
            maxBranches: 3,
            maxDevices: 2,
            maxStorageMB: 2000,
            features: {
                payroll: true,
                recruitment: true,
                performance: true,
                expenses: true,
                loans: true,
                biometric: true,
                apiAccess: false,
                customDocuments: true,
                advancedReports: true,
                compliance: false,
            },
            sortOrder: 2,
        },
        {
            name: "Enterprise",
            slug: "enterprise",
            description:
                "For large organizations with advanced compliance and API needs.",
            priceMonthly: 1499900, // ৳14,999/month
            priceYearly: 14999900, // ৳1,49,999/year
            currency: "BDT",
            maxEmployees: -1, // Unlimited
            maxAdmins: -1, // Unlimited
            maxBranches: -1, // Unlimited
            maxDevices: -1, // Unlimited
            maxStorageMB: 10000, // 10GB
            features: {
                payroll: true,
                recruitment: true,
                performance: true,
                expenses: true,
                loans: true,
                biometric: true,
                apiAccess: true,
                customDocuments: true,
                advancedReports: true,
                compliance: true,
            },
            sortOrder: 3,
        },
    ];

    for (const plan of plans) {
        const existing = await prisma.plan.findUnique({
            where: { slug: plan.slug },
        });

        if (existing) {
            await prisma.plan.update({
                where: { slug: plan.slug },
                data: plan,
            });
            console.log(`  ✅ Updated plan: ${plan.name}`);
        } else {
            await prisma.plan.create({ data: plan });
            console.log(`  ✅ Created plan: ${plan.name}`);
        }
    }

    // ============================================
    // 2. SEED PLATFORM ADMIN
    // ============================================

    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
    const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;

    if (!adminEmail && !adminPassword) {
        console.log("\n  ℹ️  PLATFORM_ADMIN_EMAIL/PASSWORD not set; skipping Platform Admin seed.");
        console.log("     Set both variables explicitly when creating the first platform admin.");
        console.log("\n✅ Seeding complete!\n");
        return;
    }

    if (!adminEmail || !adminPassword) {
        throw new Error("Set both PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD to seed a platform admin.");
    }

    if (
        adminPassword.length < 16 ||
        !/[a-z]/.test(adminPassword) ||
        !/[A-Z]/.test(adminPassword) ||
        !/[0-9]/.test(adminPassword) ||
        !/[^A-Za-z0-9]/.test(adminPassword)
    ) {
        throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 16 chars and include upper, lower, number, and symbol.");
    }

    const existingAdmin = await prisma.platformAdmin.findUnique({
        where: { email: adminEmail },
    });

    if (!existingAdmin) {
        const hashedPassword = await hash(adminPassword, 12);
        await prisma.platformAdmin.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: "Platform Administrator",
                role: "platform_super",
                isActive: true,
            },
        });
        console.log(`\n  🔐 Created Platform Admin:`);
        console.log(`     Email: ${adminEmail}`);
    } else {
        console.log(`\n  ℹ️  Platform Admin already exists: ${adminEmail}`);
    }

    console.log("\n✅ Seeding complete!\n");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
