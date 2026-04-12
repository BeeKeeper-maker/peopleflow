/**
 * Database Seed Script
 * Creates initial data for testing and demo purposes
 */

import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seed...");

    // 1. Create Organization
    const organization = await prisma.organization.upsert({
        where: { slug: "demo-company" },
        update: {},
        create: {
            name: "Demo Company Ltd.",
            slug: "demo-company",
            industry: "Technology",
            employeeCountRange: "50-100",
            countryCode: "BD",
            currencyCode: "BDT",
            timezone: "Asia/Dhaka",
            settings: JSON.stringify({
                theme: "dark",
                language: "en",
            }),
        },
    });
    console.log("✅ Organization created:", organization.name);

    // 2. Create Admin User
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    const adminUser = await prisma.user.upsert({
        where: { email: "admin@demo.com" },
        update: {},
        create: {
            email: "admin@demo.com",
            name: "System Admin",
            password: hashedPassword,
            role: "admin",
            organizationId: organization.id,
        },
    });
    console.log("✅ Admin user created:", adminUser.email);

    // 3. Create Departments
    const departments = await Promise.all([
        prisma.department.upsert({
            where: { id: "dept-hr" },
            update: {},
            create: {
                id: "dept-hr",
                name: "Human Resources",
                code: "HR",
                organizationId: organization.id,
            },
        }),
        prisma.department.upsert({
            where: { id: "dept-eng" },
            update: {},
            create: {
                id: "dept-eng",
                name: "Engineering",
                code: "ENG",
                organizationId: organization.id,
            },
        }),
        prisma.department.upsert({
            where: { id: "dept-sales" },
            update: {},
            create: {
                id: "dept-sales",
                name: "Sales & Marketing",
                code: "SAL",
                organizationId: organization.id,
            },
        }),
        prisma.department.upsert({
            where: { id: "dept-fin" },
            update: {},
            create: {
                id: "dept-fin",
                name: "Finance",
                code: "FIN",
                organizationId: organization.id,
            },
        }),
    ]);
    console.log("✅ Departments created:", departments.length);

    // 4. Create Designations
    const designations = await Promise.all([
        prisma.designation.upsert({
            where: { id: "des-ceo" },
            update: {},
            create: {
                id: "des-ceo",
                name: "Chief Executive Officer",
                grade: 1,
                organizationId: organization.id,
            },
        }),
        prisma.designation.upsert({
            where: { id: "des-manager" },
            update: {},
            create: {
                id: "des-manager",
                name: "Manager",
                grade: 3,
                organizationId: organization.id,
            },
        }),
        prisma.designation.upsert({
            where: { id: "des-senior" },
            update: {},
            create: {
                id: "des-senior",
                name: "Senior Executive",
                grade: 4,
                organizationId: organization.id,
            },
        }),
        prisma.designation.upsert({
            where: { id: "des-exec" },
            update: {},
            create: {
                id: "des-exec",
                name: "Executive",
                grade: 5,
                organizationId: organization.id,
            },
        }),
    ]);
    console.log("✅ Designations created:", designations.length);

    // 5. Create Leave Types
    const leaveTypes = await Promise.all([
        prisma.leaveType.upsert({
            where: { id: "lt-annual" },
            update: {},
            create: {
                id: "lt-annual",
                name: "Annual Leave",
                code: "AL",
                annualAllocation: 15,
                requiresDocument: false,
                organizationId: organization.id,
            },
        }),
        prisma.leaveType.upsert({
            where: { id: "lt-sick" },
            update: {},
            create: {
                id: "lt-sick",
                name: "Sick Leave",
                code: "SL",
                annualAllocation: 10,
                requiresDocument: true,
                organizationId: organization.id,
            },
        }),
        prisma.leaveType.upsert({
            where: { id: "lt-casual" },
            update: {},
            create: {
                id: "lt-casual",
                name: "Casual Leave",
                code: "CL",
                annualAllocation: 10,
                requiresDocument: false,
                organizationId: organization.id,
            },
        }),
    ]);
    console.log("✅ Leave types created:", leaveTypes.length);

    // 6. Create Expense Categories
    const expenseCategories = await Promise.all([
        prisma.expenseCategory.upsert({
            where: { id: "ec-travel" },
            update: {},
            create: {
                id: "ec-travel",
                name: "Travel",
                description: "Transportation and travel expenses",
                maxAmount: 50000,
                monthlyLimit: 100000,
                requiresReceipt: true,
                icon: "Car",
                color: "#3B82F6",
                organizationId: organization.id,
            },
        }),
        prisma.expenseCategory.upsert({
            where: { id: "ec-meals" },
            update: {},
            create: {
                id: "ec-meals",
                name: "Meals",
                description: "Food and dining expenses",
                maxAmount: 5000,
                monthlyLimit: 20000,
                requiresReceipt: true,
                icon: "UtensilsCrossed",
                color: "#10B981",
                organizationId: organization.id,
            },
        }),
        prisma.expenseCategory.upsert({
            where: { id: "ec-office" },
            update: {},
            create: {
                id: "ec-office",
                name: "Office Supplies",
                description: "Stationery and office items",
                maxAmount: 10000,
                monthlyLimit: 30000,
                requiresReceipt: true,
                icon: "Package",
                color: "#8B5CF6",
                organizationId: organization.id,
            },
        }),
    ]);
    console.log("✅ Expense categories created:", expenseCategories.length);

    // 7. Create Shift
    const shift = await prisma.shift.upsert({
        where: { id: "shift-default" },
        update: {},
        create: {
            id: "shift-default",
            name: "General Shift",
            code: "GEN",
            startTime: "09:00",
            endTime: "18:00",
            breakDuration: 60,
            fullDayHours: 8,
            organizationId: organization.id,
        },
    });
    console.log("✅ Default shift created");

    // 8. Create HR Manager Employee
    const hrManager = await prisma.employee.upsert({
        where: { organizationId_employeeCode: { organizationId: organization.id, employeeCode: "EMP-001" } },
        update: {},
        create: {
            employeeCode: "EMP-001",
            firstName: "Rahim",
            lastName: "Khan",
            email: "rahim@demo.com",
            phone: "+880 1711-123456",
            gender: "male",
            dateOfBirth: new Date("1985-05-15"),
            joiningDate: new Date("2020-01-01"),
            employmentType: "permanent",
            employmentStatus: "active",
            organizationId: organization.id,
            departmentId: departments[0].id, // HR
            designationId: designations[1].id, // Manager
            shiftId: shift.id,
        },
    });

    // Create user for HR Manager, then link Employee → User
    const hrUser = await prisma.user.upsert({
        where: { email: "rahim@demo.com" },
        update: {},
        create: {
            email: "rahim@demo.com",
            name: "Rahim Khan",
            password: hashedPassword,
            role: "hr_admin",
            organizationId: organization.id,
        },
    });
    // Link employee to user (FK is on Employee.userId, not User.employeeId)
    await prisma.employee.update({
        where: { id: hrManager.id },
        data: { userId: hrUser.id },
    });
    console.log("✅ HR Manager created:", hrManager.firstName, hrManager.lastName);

    // 9. Create Sample Employees
    const employees = [
        {
            code: "EMP-002",
            firstName: "Karim",
            lastName: "Ahmed",
            email: "karim@demo.com",
            gender: "male",
            department: 1, // Engineering
            designation: 1, // Manager
            role: "manager",
        },
        {
            code: "EMP-003",
            firstName: "Fatima",
            lastName: "Begum",
            email: "fatima@demo.com",
            gender: "female",
            department: 1, // Engineering
            designation: 2, // Senior
            role: "employee",
        },
        {
            code: "EMP-004",
            firstName: "Ali",
            lastName: "Hossain",
            email: "ali@demo.com",
            gender: "male",
            department: 2, // Sales
            designation: 3, // Executive
            role: "employee",
        },
    ];

    for (const emp of employees) {
        const employee = await prisma.employee.upsert({
            where: { organizationId_employeeCode: { organizationId: organization.id, employeeCode: emp.code } },
            update: {},
            create: {
                employeeCode: emp.code,
                firstName: emp.firstName,
                lastName: emp.lastName,
                email: emp.email,
                gender: emp.gender,
                dateOfBirth: new Date("1990-01-01"),
                joiningDate: new Date("2022-01-01"),
                employmentType: "permanent",
                employmentStatus: "active",
                organizationId: organization.id,
                departmentId: departments[emp.department].id,
                designationId: designations[emp.designation].id,
                shiftId: shift.id,
                reportingManagerId: emp.role === "employee" ? hrManager.id : undefined,
            },
        });

        const empUser = await prisma.user.upsert({
            where: { email: emp.email },
            update: {},
            create: {
                email: emp.email,
                name: `${emp.firstName} ${emp.lastName}`,
                password: hashedPassword,
                role: emp.role,
                organizationId: organization.id,
            },
        });
        // Link employee to user (FK is on Employee.userId)
        await prisma.employee.update({
            where: { id: employee.id },
            data: { userId: empUser.id },
        });
    }
    console.log("✅ Sample employees created:", employees.length);

    console.log("");
    console.log("🎉 Database seed completed!");
    console.log("");
    console.log("📋 Login Credentials:");
    console.log("   Admin:      admin@demo.com / Admin@123");
    console.log("   HR Manager: rahim@demo.com / Admin@123");
    console.log("   Manager:    karim@demo.com / Admin@123");
    console.log("   Employee:   fatima@demo.com / Admin@123");
    console.log("");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
