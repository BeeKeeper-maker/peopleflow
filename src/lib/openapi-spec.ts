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
        // ════════════════════════════════════════════════════════════════
        // Platform / Internal endpoints (base path: /api, not /api/v1)
        // Each path overrides the global /api/v1 server via path-level
        // `servers`. Authentication requirements vary by endpoint.
        // ════════════════════════════════════════════════════════════════
        "/employees/bulk-import": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            post: {
                tags: ["Employees"],
                summary: "Bulk import employees via CSV",
                description:
                    "Upload a CSV file to bulk import employees. Returns a row-by-row preview of valid/invalid rows by default. " +
                    "When `confirm=true` is sent alongside the file, the validated rows are actually created inside the caller's tenant (RLS-scoped). " +
                    "Requires admin or HR role. Maximum 1000 rows per upload. " +
                    "CSV header row is required (case-insensitive): employeeCode, firstName, lastName, email, phone, department, designation, joiningDate, employmentType, gender.",
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    file: {
                                        type: "string",
                                        format: "binary",
                                        description: "CSV file with employee rows.",
                                    },
                                    confirm: {
                                        type: "string",
                                        enum: ["true", "false"],
                                        description: "When 'true', persists the validated rows. Defaults to preview-only.",
                                    },
                                },
                                required: ["file"],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Preview or confirmation result",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        totalRows: { type: "integer" },
                                        validRows: { type: "integer" },
                                        invalidRows: { type: "integer" },
                                        created: { type: "integer", description: "Populated when confirm=true" },
                                        errors: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    rowNumber: { type: "integer" },
                                                    employeeCode: { type: "string" },
                                                    errors: { type: "array", items: { type: "string" } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request — missing file or invalid format", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — admin/HR role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/employees/{id}/final-settlement": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: {
                tags: ["Employees", "Payroll"],
                summary: "Preview final settlement calculation",
                description:
                    "Calculates a full & final settlement preview for an employee (pro-rated salary, leave encashment, gratuity, notice pay, PF withdrawal, loan recovery). " +
                    "Bangladesh Labour Act 2006 compliant (Sections 23, 26, 27, 100). Read-only — does not mutate any records. " +
                    "Requires admin or HR role.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: "lastWorkingDate", in: "query", required: true, schema: { type: "string", format: "date" } },
                    {
                        name: "separationType",
                        in: "query",
                        required: true,
                        schema: { type: "string", enum: ["resignation", "termination", "retirement", "death", "dismissal"] },
                    },
                    { name: "noticeGiven", in: "query", schema: { type: "boolean" } },
                    { name: "noticeDaysServed", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    "200": {
                        description: "Settlement preview",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        employeeId: { type: "string" },
                                        lastWorkingDate: { type: "string", format: "date" },
                                        separationType: { type: "string" },
                                        proRatedSalary: { type: "number" },
                                        leaveEncashment: { type: "number" },
                                        gratuity: { type: "number" },
                                        noticePay: { type: "number" },
                                        pfWithdrawal: { type: "number" },
                                        loanRecovery: { type: "number" },
                                        totalPayable: { type: "number" },
                                        totalDeductions: { type: "number" },
                                        netPayable: { type: "number" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request — invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — admin/HR role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "404": { description: "Employee not found" },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
            post: {
                tags: ["Employees", "Payroll"],
                summary: "Compute final settlement for a specific date",
                description:
                    "Computes the final settlement for a specific last-working date and separation type. Functionally equivalent to the GET preview — the engine is identical — but accepts the input as a JSON body for clients that prefer POST semantics. " +
                    "Does not persist a record by itself; persisting the offboarding is handled by DELETE /api/employees/{id}. " +
                    "Requires admin or HR role.",
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    lastWorkingDate: { type: "string", format: "date" },
                                    separationType: { type: "string", enum: ["resignation", "termination", "retirement", "death", "dismissal"] },
                                    noticeGiven: { type: "boolean" },
                                    noticeDaysServed: { type: "integer" },
                                },
                                required: ["lastWorkingDate", "separationType"],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Settlement calculation result",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        employeeId: { type: "string" },
                                        lastWorkingDate: { type: "string", format: "date" },
                                        separationType: { type: "string" },
                                        proRatedSalary: { type: "number" },
                                        leaveEncashment: { type: "number" },
                                        gratuity: { type: "number" },
                                        noticePay: { type: "number" },
                                        pfWithdrawal: { type: "number" },
                                        loanRecovery: { type: "number" },
                                        totalPayable: { type: "number" },
                                        totalDeductions: { type: "number" },
                                        netPayable: { type: "number" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request — invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — admin/HR role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "404": { description: "Employee not found" },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/admin/system-stats": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            get: {
                tags: ["Admin"],
                summary: "Get system monitoring stats",
                description:
                    "Returns a read-only snapshot of system health for the admin/HR monitoring dashboard: " +
                    "(1) database row counts (RLS-scoped to the caller's organization), " +
                    "(2) Redis connection state + aggregate BullMQ queue depth, " +
                    "(3) Node.js process info (uptime, memory, version, environment). " +
                    "No DB credentials, connection strings, or Redis URLs are exposed. " +
                    "Requires admin or HR role.",
                security: [{ BearerAuth: [] }],
                responses: {
                    "200": {
                        description: "System stats snapshot",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        timestamp: { type: "string", format: "date-time" },
                                        database: {
                                            type: "object",
                                            properties: {
                                                totalEmployees: { type: "integer" },
                                                activeEmployees: { type: "integer" },
                                                totalAttendanceToday: { type: "integer" },
                                                totalLeaveApplications: { type: "integer" },
                                                pendingApprovals: { type: "integer" },
                                                totalSalarySlips: { type: "integer" },
                                            },
                                        },
                                        redis: {
                                            type: "object",
                                            properties: {
                                                connected: { type: "boolean" },
                                                queueDepth: { type: "integer" },
                                            },
                                        },
                                        system: {
                                            type: "object",
                                            properties: {
                                                uptime: { type: "number", description: "Seconds" },
                                                memoryUsage: {
                                                    type: "object",
                                                    properties: {
                                                        rss: { type: "integer" },
                                                        heapUsed: { type: "integer" },
                                                        heapTotal: { type: "integer" },
                                                    },
                                                },
                                                nodeVersion: { type: "string" },
                                                environment: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — admin/HR role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/cron/scheduled-reports": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            get: {
                tags: ["Cron"],
                summary: "Run scheduled reports worker (cron-triggered)",
                description:
                    "Cron-triggered endpoint that picks up ScheduledReport rows whose `nextRunAt <= now()` and " +
                    "executes the underlying SavedReport within the owning tenant's RLS context, emails the result to each recipient, " +
                    "and advances `nextRunAt` based on the schedule's `frequency`. Schedule: every 15 minutes. " +
                    "Auth is via a shared CRON secret (verifyCronAuth) — not a Bearer token. RLS: cross-tenant schedule discovery uses the platform admin RLS bypass; per-tenant work is wrapped in `withTenant(orgId)`.",
                responses: {
                    "200": {
                        description: "Worker run completed",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        processed: { type: "integer", description: "Number of schedules executed" },
                                        failed: { type: "integer", description: "Number of schedules that errored" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized — missing or invalid CRON secret", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/notifications/push/send": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            post: {
                tags: ["Notifications"],
                summary: "Send a push notification to the caller's devices",
                description:
                    "Internal endpoint (typically called by the event worker) to send a web push notification to all of the calling user's subscribed devices. " +
                    "A user may have only one pushSubscription stored at a time (the most recent device). " +
                    "Requires an authenticated session — the worker calls it with a service-account session.",
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    message: { type: "string" },
                                    url: { type: "string", description: "Optional URL to open when the notification is clicked" },
                                },
                                required: ["title", "message"],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Send attempt completed",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        sent: { type: "integer", description: "Number of subscriptions successfully sent to" },
                                        failed: { type: "integer", description: "Number of subscriptions that failed" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request — title and message are required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/notifications/push/vapid-key": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            get: {
                tags: ["Notifications"],
                summary: "Get VAPID public key",
                description:
                    "Returns the VAPID public key so the browser can subscribe to push notifications via " +
                    "`serviceWorkerRegistration.pushManager.subscribe({ applicationServerKey: urlBase64ToUint8Array(publicKey) })`. " +
                    "The public key is safe to expose to the client; the private key never leaves the server. " +
                    "Requires an authenticated session.",
                security: [{ BearerAuth: [] }],
                responses: {
                    "200": {
                        description: "VAPID public key",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        publicKey: { type: "string", description: "Base64-url-encoded VAPID public key" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "503": { description: "Push notifications not configured on the server", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/platform/billing": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            get: {
                tags: ["Platform"],
                summary: "List platform invoices with revenue metrics",
                description:
                    "Returns paginated invoices across all tenants with revenue metrics. " +
                    "Platform admin only — authenticated via a platform token (verifyPlatformRequest), not the standard tenant Bearer token. " +
                    "Supports filtering by invoice status, tenant/invoice-number search, and a date range on createdAt.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                    { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
                    { name: "status", in: "query", schema: { type: "string", enum: ["pending", "paid", "failed", "refunded", "void", "all"] } },
                    { name: "search", in: "query", schema: { type: "string", description: "Tenant name or invoice number" } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: {
                    "200": {
                        description: "Paginated invoices with revenue metrics",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    invoiceNumber: { type: "string" },
                                                    tenant: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
                                                    amount: { type: "number" },
                                                    currency: { type: "string" },
                                                    status: { type: "string", enum: ["pending", "paid", "failed", "refunded", "void"] },
                                                    createdAt: { type: "string", format: "date-time" },
                                                },
                                            },
                                        },
                                        total: { type: "integer" },
                                        page: { type: "integer" },
                                        limit: { type: "integer" },
                                        revenue: {
                                            type: "object",
                                            properties: {
                                                totalPaid: { type: "number" },
                                                totalPending: { type: "number" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized — missing or invalid platform token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — platform admin role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/platform/settings/admins": {
            servers: [
                { url: "https://peopleflowbd.online/api", description: "Production" },
                { url: "http://localhost:3000/api", description: "Development" },
            ],
            get: {
                tags: ["Platform"],
                summary: "List platform admins",
                description:
                    "Returns all platform admin accounts (excluding password hashes). Platform admin only.",
                security: [{ BearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of platform admins",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            email: { type: "string", format: "email" },
                                            name: { type: "string" },
                                            role: { type: "string", enum: ["platform_admin", "platform_super"] },
                                            createdAt: { type: "string", format: "date-time" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized — missing or invalid platform token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — platform admin role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
            post: {
                tags: ["Platform"],
                summary: "Create a new platform admin",
                description:
                    "Creates a new platform admin account. Super-admin only (platform_super role). " +
                    "Password is hashed via bcrypt before storage. Validates input via Zod schema: name (2-100 chars), email (valid), role (platform_admin|platform_super), password (8-128 chars).",
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    name: { type: "string", minLength: 2, maxLength: 100 },
                                    email: { type: "string", format: "email", maxLength: 255 },
                                    role: { type: "string", enum: ["platform_admin", "platform_super"], default: "platform_admin" },
                                    password: { type: "string", minLength: 8, maxLength: 128, format: "password" },
                                },
                                required: ["name", "email", "password"],
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Platform admin created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        email: { type: "string", format: "email" },
                                        name: { type: "string" },
                                        role: { type: "string", enum: ["platform_admin", "platform_super"] },
                                        createdAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request — validation failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized — missing or invalid platform token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "403": { description: "Forbidden — super-admin role required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
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
