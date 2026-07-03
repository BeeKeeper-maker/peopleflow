/**
 * PeopleFlow HRMS — Public REST API v1
 *
 * This module provides OpenAPI 3.0 specification for PeopleFlow's
 * public REST API, enabling third-party integrations (ERP sync,
 * accounting software, custom dashboards, mobile apps).
 *
 * The API is organized into modules:
 *   - Employees: CRUD, import, export
 *   - Attendance: check-in/out, regularization, reports
 *   - Leave: applications, approvals, balances
 *   - Payroll: process, slips, bank file
 *   - Organization: departments, designations, branches, shifts
 *
 * Authentication: Bearer token (API key with scoped permissions)
 *   Header: Authorization: Bearer pf_live_xxxxxxxxxxxx
 *
 * Rate limiting: 100 requests per minute per API key
 * Base URL: https://peopleflowbd.online/api/v1
 *
 * Versioning: URL-based (/api/v1/...). Breaking changes require
 * a new version (/api/v2/...). Non-breaking changes (new fields,
 * new endpoints) are additive within the same version.
 */

export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
        contact: { name: string; email: string };
        license: { name: string; url: string };
    };
    servers: Array<{ url: string; description: string }>;
    components: {
        securitySchemes: {
            BearerAuth: { type: string; scheme: string; bearerFormat: string };
        };
        schemas: Record<string, unknown>;
    };
    security: Array<{ BearerAuth: string[] }>;
    paths: Record<string, Record<string, unknown>>;
}

export const openApiSpec: OpenAPISpec = {
    openapi: "3.0.3",
    info: {
        title: "PeopleFlow HRMS API",
        description: "Enterprise HRMS REST API for Bangladesh-focused organizations. Manage employees, attendance, leave, payroll, and more.",
        version: "1.0.0",
        contact: { name: "PeopleFlow Support", email: "support@peopleflowbd.online" },
        license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    servers: [
        { url: "https://peopleflowbd.online/api/v1", description: "Production" },
        { url: "http://localhost:3000/api/v1", description: "Development" },
    ],
    components: {
        securitySchemes: {
            BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Key (pf_live_xxx)" },
        },
        schemas: {
            Employee: {
                type: "object",
                properties: {
                    id: { type: "string", example: "emp_abc123" },
                    employeeCode: { type: "string", example: "EMP0001" },
                    firstName: { type: "string", example: "Mohammad" },
                    lastName: { type: "string", example: "Rahman" },
                    email: { type: "string", format: "email", example: "rahman@company.com" },
                    phone: { type: "string", example: "+8801712345678" },
                    department: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
                    designation: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
                    branch: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
                    employmentType: { type: "string", enum: ["permanent", "contractual", "intern", "probation"] },
                    employmentStatus: { type: "string", enum: ["active", "resigned", "terminated", "retired"] },
                    joiningDate: { type: "string", format: "date" },
                },
            },
            Attendance: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    date: { type: "string", format: "date" },
                    checkIn: { type: "string", format: "date-time", nullable: true },
                    checkOut: { type: "string", format: "date-time", nullable: true },
                    status: { type: "string", enum: ["present", "absent", "half_day", "on_leave", "holiday", "weekend"] },
                    lateMinutes: { type: "integer" },
                    earlyLeaveMinutes: { type: "integer" },
                    overtimeMinutes: { type: "integer" },
                    source: { type: "string", enum: ["web", "mobile", "biometric", "manual"] },
                },
            },
            LeaveApplication: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    fromDate: { type: "string", format: "date" },
                    toDate: { type: "string", format: "date" },
                    totalDays: { type: "number" },
                    halfDay: { type: "boolean" },
                    status: { type: "string", enum: ["pending", "approved", "rejected", "cancelled"] },
                    leaveType: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
                    reason: { type: "string" },
                },
            },
            SalarySlip: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    month: { type: "integer", minimum: 1, maximum: 12 },
                    year: { type: "integer" },
                    grossSalary: { type: "number" },
                    totalDeductions: { type: "number" },
                    netSalary: { type: "number" },
                    status: { type: "string", enum: ["draft", "approved", "paid", "reversed"] },
                },
            },
            Error: {
                type: "object",
                properties: {
                    error: { type: "string", example: "Unauthorized" },
                    code: { type: "string", example: "AUTH_REQUIRED" },
                },
            },
        },
    },
    security: [{ BearerAuth: [] }],
    paths: {
        "/employees": {
            get: {
                summary: "List employees",
                description: "Returns a paginated list of employees in the organization.",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                    { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
                    { name: "departmentId", in: "query", schema: { type: "string" } },
                    { name: "status", in: "query", schema: { type: "string", enum: ["active", "resigned", "terminated"] } },
                ],
                responses: {
                    "200": { description: "Success", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Employee" } } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/employees/{id}": {
            get: {
                summary: "Get employee by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/Employee" } } } },
                    "404": { description: "Not found" },
                },
            },
        },
        "/leaves": {
            get: {
                summary: "List leave applications",
                parameters: [
                    { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] } },
                    { name: "employeeId", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Success", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/LeaveApplication" } } } } },
                },
            },
        },
        "/sync/push": {
            post: {
                summary: "Push attendance data (Sync Agent)",
                description: "Receives biometric attendance punch data from the PeopleFlow Sync Agent.",
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    deviceIp: { type: "string" },
                                    devicePort: { type: "integer" },
                                    records: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                userId: { type: "string" },
                                                timestamp: { type: "string", format: "date-time" },
                                                type: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Sync successful" },
                    "422": { description: "All punches unmapped" },
                },
            },
        },
        "/organization": {
            get: {
                summary: "Get organization config",
                responses: {
                    "200": {
                        description: "Success",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        slug: { type: "string" },
                                        timezone: { type: "string" },
                                        currencyCode: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

/**
 * Get the OpenAPI spec as a JSON string.
 * Used by the /api/v1/docs endpoint.
 */
export function getOpenApiJson(): string {
    return JSON.stringify(openApiSpec, null, 2);
}
