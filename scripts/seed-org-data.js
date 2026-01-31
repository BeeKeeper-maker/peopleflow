const path = require('path');
// Import directly from the generated client since custom output is used
const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
    // Try to find the user created in Phase 1
    // If not found, create one or use the one from register API verification
    const email = 'testadmin@test.com';

    let user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.log('User not found, trying alternate email...');
        // Maybe try another common test email or just list users
        const users = await prisma.user.findMany({ take: 1 });
        if (users.length > 0) {
            user = users[0];
            console.log(`Found user: ${user.email}`);
        } else {
            console.error('No users found in database. Please register first.');
            return;
        }
    }

    if (!user.organizationId) {
        console.error('User has no organizationId');
        return;
    }

    const orgId = user.organizationId;

    console.log(`Seeding data for organization: ${orgId}`);

    // Create Departments
    const departments = [
        { name: 'Engineering', code: 'ENG' },
        { name: 'Human Resources', code: 'HR' },
        { name: 'Sales', code: 'SAL' },
        { name: 'Marketing', code: 'MKT' },
        { name: 'Finance', code: 'FIN' },
    ];

    for (const dept of departments) {
        // Check if exists using findFirst (since organizationId_code unique constraint might apply)
        // Actually schema says @@unique([organizationId, code]) for Department
        const existing = await prisma.department.findUnique({
            where: { organizationId_code: { organizationId: orgId, code: dept.code } }
        });

        if (!existing) {
            console.log(`Creating department: ${dept.name}`);
            await prisma.department.create({
                data: {
                    name: dept.name,
                    code: dept.code,
                    organizationId: orgId,
                }
            });
        } else {
            console.log(`Department exists: ${dept.name}`);
        }
    }

    // Create Designations
    const designations = [
        { name: 'Software Engineer', code: 'SE', grade: 1 },
        { name: 'Senior Software Engineer', code: 'SSE', grade: 2 },
        { name: 'Team Lead', code: 'TL', grade: 3 },
        { name: 'Engineering Manager', code: 'EM', grade: 4 },
        { name: 'HR Executive', code: 'HRE', grade: 1 },
        { name: 'HR Manager', code: 'HRM', grade: 3 },
        { name: 'Sales Associate', code: 'SA', grade: 1 },
        { name: 'Sales Manager', code: 'SM', grade: 3 },
    ];

    for (const desig of designations) {
        const existing = await prisma.designation.findUnique({
            where: { organizationId_code: { organizationId: orgId, code: desig.code } }
        });

        if (!existing) {
            console.log(`Creating designation: ${desig.name}`);
            await prisma.designation.create({
                data: {
                    name: desig.name,
                    code: desig.code,
                    grade: desig.grade,
                    organizationId: orgId,
                }
            });
        } else {
            console.log(`Designation exists: ${desig.name}`);
        }
    }

    console.log('Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
