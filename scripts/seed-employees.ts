/**
 * PeopleFlow Demo Data Seed Script
 * Generates a realistic Bangladesh-market organization with 30 employees.
 *
 * Run: npx tsx scripts/seed-employees.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════
// REALISTIC BANGLADESH-MARKET DATA
// ══════════════════════════════════════════════════════════════════

const DEPARTMENTS = [
    { name: "Engineering", code: "ENG", nameBn: "প্রকৌশল" },
    { name: "Human Resources", code: "HR", nameBn: "মানবসম্পদ" },
    { name: "Sales & Marketing", code: "SM", nameBn: "বিক্রয় ও বিপণন" },
    { name: "Finance & Accounts", code: "FIN", nameBn: "অর্থ ও হিসাব" },
    { name: "RMG Production", code: "RMG", nameBn: "আরএমজি উৎপাদন" },
    { name: "Operations", code: "OPS", nameBn: "পরিচালনা" },
    { name: "Quality Assurance", code: "QA", nameBn: "মান নিয়ন্ত্রণ" },
    { name: "Administration", code: "ADM", nameBn: "প্রশাসন" },
];

const DESIGNATIONS = [
    { name: "Chief Executive Officer", code: "CEO", grade: 1 },
    { name: "Chief Technology Officer", code: "CTO", grade: 2 },
    { name: "VP of Engineering", code: "VP-ENG", grade: 3 },
    { name: "Senior Manager", code: "SM", grade: 4 },
    { name: "Manager", code: "MGR", grade: 5 },
    { name: "Assistant Manager", code: "AM", grade: 6 },
    { name: "Team Lead", code: "TL", grade: 7 },
    { name: "Senior Software Engineer", code: "SSE", grade: 8 },
    { name: "Software Engineer", code: "SE", grade: 9 },
    { name: "Junior Engineer", code: "JE", grade: 10 },
    { name: "HR Executive", code: "HRE", grade: 8 },
    { name: "Accountant", code: "ACC", grade: 8 },
    { name: "Sales Executive", code: "SLE", grade: 9 },
    { name: "Production Supervisor", code: "PS", grade: 7 },
    { name: "Quality Inspector", code: "QI", grade: 9 },
    { name: "Office Executive", code: "OE", grade: 10 },
    { name: "Intern", code: "INT", grade: 12 },
];

// 30 realistic Bangladeshi employees
const EMPLOYEES = [
    { firstName: "Farhan", lastName: "Rahman", gender: "male", dept: "ENG", desig: "CTO", type: "permanent", manager: null },
    { firstName: "Nusrat", lastName: "Jahan", gender: "female", dept: "HR", desig: "SM", type: "permanent", manager: null },
    { firstName: "Tanvir", lastName: "Hossain", gender: "male", dept: "ENG", desig: "VP-ENG", type: "permanent", manager: "EMP-001" },
    { firstName: "Anika", lastName: "Tasnim", gender: "female", dept: "ENG", desig: "TL", type: "permanent", manager: "EMP-003" },
    { firstName: "Rafiq", lastName: "Ahmed", gender: "male", dept: "ENG", desig: "SSE", type: "permanent", manager: "EMP-004" },
    { firstName: "Sabrina", lastName: "Islam", gender: "female", dept: "ENG", desig: "SE", type: "permanent", manager: "EMP-004" },
    { firstName: "Imran", lastName: "Khan", gender: "male", dept: "ENG", desig: "SE", type: "permanent", manager: "EMP-004" },
    { firstName: "Fahmida", lastName: "Akter", gender: "female", dept: "ENG", desig: "JE", type: "probation", manager: "EMP-005" },
    { firstName: "Arif", lastName: "Hasan", gender: "male", dept: "ENG", desig: "INT", type: "intern", manager: "EMP-005" },
    { firstName: "Nazmul", lastName: "Haque", gender: "male", dept: "SM", desig: "MGR", type: "permanent", manager: null },
    { firstName: "Mithila", lastName: "Chowdhury", gender: "female", dept: "SM", desig: "SLE", type: "permanent", manager: "EMP-010" },
    { firstName: "Mehedi", lastName: "Hassan", gender: "male", dept: "SM", desig: "SLE", type: "permanent", manager: "EMP-010" },
    { firstName: "Taslima", lastName: "Begum", gender: "female", dept: "HR", desig: "HRE", type: "permanent", manager: "EMP-002" },
    { firstName: "Rezaul", lastName: "Karim", gender: "male", dept: "HR", desig: "AM", type: "permanent", manager: "EMP-002" },
    { firstName: "Farzana", lastName: "Sultana", gender: "female", dept: "FIN", desig: "SM", type: "permanent", manager: null },
    { firstName: "Shakil", lastName: "Mahmud", gender: "male", dept: "FIN", desig: "ACC", type: "permanent", manager: "EMP-015" },
    { firstName: "Ruma", lastName: "Das", gender: "female", dept: "FIN", desig: "ACC", type: "permanent", manager: "EMP-015" },
    { firstName: "Kamrul", lastName: "Hasan", gender: "male", dept: "RMG", desig: "SM", type: "permanent", manager: null },
    { firstName: "Ayesha", lastName: "Siddiqua", gender: "female", dept: "RMG", desig: "PS", type: "permanent", manager: "EMP-018" },
    { firstName: "Jamal", lastName: "Uddin", gender: "male", dept: "RMG", desig: "PS", type: "permanent", manager: "EMP-018" },
    { firstName: "Salma", lastName: "Khatun", gender: "female", dept: "RMG", desig: "QI", type: "permanent", manager: "EMP-019" },
    { firstName: "Mahbub", lastName: "Alam", gender: "male", dept: "RMG", desig: "QI", type: "contractual", manager: "EMP-019" },
    { firstName: "Tania", lastName: "Akhter", gender: "female", dept: "OPS", desig: "MGR", type: "permanent", manager: null },
    { firstName: "Sohel", lastName: "Rana", gender: "male", dept: "OPS", desig: "AM", type: "permanent", manager: "EMP-023" },
    { firstName: "Laila", lastName: "Sharmin", gender: "female", dept: "QA", desig: "TL", type: "permanent", manager: null },
    { firstName: "Asif", lastName: "Iqbal", gender: "male", dept: "QA", desig: "SE", type: "permanent", manager: "EMP-025" },
    { firstName: "Nasreen", lastName: "Pervin", gender: "female", dept: "ADM", desig: "AM", type: "permanent", manager: null },
    { firstName: "Hasan", lastName: "Ali", gender: "male", dept: "ADM", desig: "OE", type: "permanent", manager: "EMP-027" },
    { firstName: "Sharmin", lastName: "Akhter", gender: "female", dept: "ENG", desig: "SE", type: "probation", manager: "EMP-004" },
    { firstName: "Rahim", lastName: "Mia", gender: "male", dept: "RMG", desig: "INT", type: "intern", manager: "EMP-020" },
];

function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function dicebearUrl(seed: string, gender: string): string {
    const style = gender === "female" ? "avataaars" : "avataaars";
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

async function main() {
    console.log("🚀 PeopleFlow Demo Data Seeder\n");

    // 1. Create demo organization
    console.log("  📦 Creating demo organization...");
    const org = await prisma.organization.upsert({
        where: { slug: "nexatech-bd" },
        update: {},
        create: {
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
    console.log(`  ✅ Organization: ${org.name} (${org.id})\n`);

    // 2. Create admin user for this org
    console.log("  👤 Creating tenant admin user...");
    const adminPassword = await hash("Admin@123", 12);
    const adminUser = await prisma.user.upsert({
        where: { email: "admin@nexatech.com.bd" },
        update: {},
        create: {
            email: "admin@nexatech.com.bd",
            name: "Farhan Rahman",
            password: adminPassword,
            role: "admin",
            isActive: true,
            organizationId: org.id,
        },
    });
    console.log(`  ✅ Admin: ${adminUser.email}\n`);

    // 3. Link org to a plan (Starter)
    const plan = await prisma.plan.findFirst({ where: { slug: "growth" } });
    if (plan) {
        await prisma.subscription.upsert({
            where: { organizationId: org.id },
            update: {},
            create: {
                organizationId: org.id,
                planId: plan.id,
                status: "active",
                billingCycle: "monthly",
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
        console.log(`  ✅ Subscription: ${plan.name} plan\n`);
    }

    // 4. Create Shift
    console.log("  🕐 Creating default shift...");
    const shift = await prisma.shift.upsert({
        where: { organizationId_code: { organizationId: org.id, code: "GEN" } },
        update: {},
        create: {
            name: "General Shift",
            code: "GEN",
            startTime: "09:00",
            endTime: "18:00",
            breakDuration: 60,
            graceMinutes: 15,
            isDefault: true,
            organizationId: org.id,
        },
    });

    // 5. Create Branch
    const branch = await prisma.branch.upsert({
        where: { organizationId_code: { organizationId: org.id, code: "HQ" } },
        update: {},
        create: {
            name: "Head Office - Gulshan",
            code: "HQ",
            address: "House 42, Road 11, Gulshan-2",
            city: "Dhaka",
            isHeadOffice: true,
            organizationId: org.id,
        },
    });

    // 6. Create Departments
    console.log("  🏢 Creating departments...");
    const deptMap: Record<string, string> = {};
    for (const d of DEPARTMENTS) {
        const dept = await prisma.department.upsert({
            where: { organizationId_code: { organizationId: org.id, code: d.code } },
            update: {},
            create: { name: d.name, code: d.code, nameBn: d.nameBn, organizationId: org.id },
        });
        deptMap[d.code] = dept.id;
    }
    console.log(`  ✅ ${DEPARTMENTS.length} departments created\n`);

    // 7. Create Designations
    console.log("  🎖️  Creating designations...");
    const desigMap: Record<string, string> = {};
    for (const d of DESIGNATIONS) {
        const desig = await prisma.designation.upsert({
            where: { organizationId_code: { organizationId: org.id, code: d.code } },
            update: {},
            create: { name: d.name, code: d.code, grade: d.grade, organizationId: org.id },
        });
        desigMap[d.code] = desig.id;
    }
    console.log(`  ✅ ${DESIGNATIONS.length} designations created\n`);

    // 8. Create 30 Employees
    console.log("  🧑‍💼 Creating 30 employees...");
    const empIdMap: Record<string, string> = {};

    for (let i = 0; i < EMPLOYEES.length; i++) {
        const e = EMPLOYEES[i];
        const code = `EMP-${String(i + 1).padStart(3, "0")}`;
        const email = `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@nexatech.com.bd`;
        const joiningDate = randomDate(new Date("2022-01-15"), new Date("2026-02-01"));

        const emp = await prisma.employee.upsert({
            where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: code } },
            update: {},
            create: {
                employeeCode: code,
                firstName: e.firstName,
                lastName: e.lastName,
                email: email,
                phone: `+880 1${Math.floor(100000000 + Math.random() * 900000000)}`,
                gender: e.gender,
                dateOfBirth: randomDate(new Date("1985-01-01"), new Date("2002-12-31")),
                nationality: "Bangladeshi",
                joiningDate: joiningDate,
                employmentType: e.type,
                employmentStatus: "active",
                photoUrl: dicebearUrl(`${e.firstName}-${e.lastName}`, e.gender),
                bankName: ["Dutch-Bangla Bank", "BRAC Bank", "City Bank", "Eastern Bank"][Math.floor(Math.random() * 4)],
                accountNumber: `${1000000000 + Math.floor(Math.random() * 9000000000)}`,
                organizationId: org.id,
                departmentId: deptMap[e.dept],
                designationId: desigMap[e.desig],
                branchId: branch.id,
                shiftId: shift.id,
                reportingManagerId: e.manager ? empIdMap[e.manager] : undefined,
            },
        });

        empIdMap[code] = emp.id;

        const statusIcon = e.type === "intern" ? "🎓" : e.type === "probation" ? "⏳" : "✅";
        console.log(`  ${statusIcon} ${code} — ${e.firstName} ${e.lastName} (${e.dept} / ${e.desig})`);
    }

    // Link admin user to first employee
    await prisma.employee.update({
        where: { id: empIdMap["EMP-001"] },
        data: { userId: adminUser.id },
    });

    console.log(`\n🎉 Seeding complete! ${EMPLOYEES.length} employees created for ${org.name}\n`);
    console.log(`   Login: admin@nexatech.com.bd / Admin@123`);
    console.log(`   Platform: platform@peopleflow.app / PlatformAdmin@2026!\n`);
}

main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
