const { PrismaClient } = require("../src/generated/prisma");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

const basePlans = [
  {
    name: "Starter",
    slug: "starter",
    description: "For small teams starting structured HR operations.",
    priceMonthly: 299900,
    priceYearly: 2999900,
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
      __marketing: {
        badge: "Launch Control",
        tagline: "Start lean, stay compliant, upgrade when the team grows.",
        audience: "Small offices and first-time HR teams",
        cta: "Start with Starter",
        highlights: ["Core employee records", "Leave and attendance foundation", "Payroll-ready structure"],
      },
    },
    sortOrder: 1,
    isActive: true,
  },
  {
    name: "Growth",
    slug: "growth",
    description: "For growing businesses that need stronger HR automation.",
    priceMonthly: 699900,
    priceYearly: 6999900,
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
      __marketing: {
        badge: "Most Balanced",
        tagline: "The operating system for scaling HR without spreadsheet chaos.",
        audience: "Growing companies with multiple teams or branches",
        cta: "Upgrade to Growth",
        highlights: ["Recruitment + performance", "Biometric/device support", "Advanced reports and document controls"],
      },
    },
    sortOrder: 2,
    isActive: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For large organizations that require control, compliance, and integrations.",
    priceMonthly: 1499900,
    priceYearly: 14999900,
    currency: "BDT",
    maxEmployees: -1,
    maxAdmins: -1,
    maxBranches: -1,
    maxDevices: -1,
    maxStorageMB: 10000,
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
      __marketing: {
        badge: "Full Command",
        tagline: "Unlimited control for enterprises with compliance and integration needs.",
        audience: "Large groups, agencies, and multi-branch organizations",
        cta: "Talk to Sales",
        highlights: ["Unlimited scale controls", "API access", "Compliance and executive reporting"],
      },
    },
    sortOrder: 3,
    isActive: true,
  },
];

async function seedPlans() {
  for (const plan of basePlans) {
    const existing = await prisma.plan.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      console.log(`[BOOT]   Plan exists: ${plan.name}`);
      continue;
    }
    await prisma.plan.create({ data: plan });
    console.log(`[BOOT]   ✅ Created plan: ${plan.name}`);
  }
}

async function seedPlatformAdmin() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email && !password) {
    console.log("[BOOT]   PLATFORM_ADMIN_EMAIL/PASSWORD not set; skipping platform admin seed");
    return;
  }

  if (!email || !password) {
    throw new Error("Set both PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD to seed a platform admin");
  }

  if (
    password.length < 16 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 16 chars and include upper, lower, number, and symbol");
  }

  const hashed = await hash(password, 12);
  await prisma.platformAdmin.upsert({
    where: { email },
    update: {
      password: hashed,
      name: "Platform Administrator",
      role: "platform_super",
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      email,
      password: hashed,
      name: "Platform Administrator",
      role: "platform_super",
      isActive: true,
    },
  });

  console.log(`[BOOT]   ✅ Platform admin ready: ${email}`);
}

async function main() {
  console.log("[BOOT] Step 2/3: Seeding SaaS defaults (idempotent)...");
  await seedPlans();
  await seedPlatformAdmin();
}

main()
  .catch((error) => {
    console.error("[BOOT]   Runtime seed failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
