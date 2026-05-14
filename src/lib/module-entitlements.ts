export type ModuleKey =
  | "coreHR"
  | "attendance"
  | "leave"
  | "payroll"
  | "biometric"
  | "expenses"
  | "loans"
  | "recruitment"
  | "performance"
  | "documents"
  | "reports"
  | "advancedReports"
  | "announcements"
  | "approvals"
  | "compliance"
  | "auditLogs"
  | "apiAccess";

export type EntitlementFeatures = Partial<Record<ModuleKey | string, boolean>>;

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  category: "core" | "time" | "money" | "talent" | "operations" | "platform";
  defaultEnabled: boolean;
  planFeatureKey?: string;
  pagePrefixes: string[];
  apiPrefixes: string[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "coreHR",
    label: "Core HR",
    description: "Employees, departments, designations, branches, shifts, holidays and organization setup.",
    category: "core",
    defaultEnabled: true,
    pagePrefixes: ["/dashboard", "/employees", "/departments", "/designations", "/organization", "/settings", "/profile", "/notifications", "/ess/dashboard", "/ess/profile", "/manager/dashboard", "/manager/team"],
    apiPrefixes: ["/api/dashboard", "/api/employees", "/api/departments", "/api/designations", "/api/branches", "/api/shifts", "/api/holidays", "/api/settings", "/api/notifications", "/api/search", "/api/upload", "/api/uploads", "/api/manager/team"],
  },
  {
    key: "attendance",
    label: "Attendance & Duty Time",
    description: "Daily attendance, check-in/out, attendance regularization and team attendance.",
    category: "time",
    defaultEnabled: true,
    pagePrefixes: ["/attendance", "/ess/attendance", "/manager/attendance"],
    apiPrefixes: ["/api/attendance", "/api/reports/attendance"],
  },
  {
    key: "leave",
    label: "Leave Management",
    description: "Leave requests, approvals, calendars, leave types, allocations, encashment and carry-forward.",
    category: "time",
    defaultEnabled: true,
    pagePrefixes: ["/leaves", "/ess/leaves", "/manager/leaves", "/manager/approvals"],
    apiPrefixes: ["/api/leaves", "/api/approval-workflows", "/api/manager/team"],
  },
  {
    key: "payroll",
    label: "Payroll & Payslips",
    description: "Salary structures, payroll processing, payslips, bank files, provident fund and festival bonus.",
    category: "money",
    defaultEnabled: false,
    planFeatureKey: "payroll",
    pagePrefixes: ["/payroll", "/ess/payslips", "/settings/late-deduction"],
    apiPrefixes: ["/api/payroll", "/api/policies/late-deduction"],
  },
  {
    key: "biometric",
    label: "Biometric / Fingerprint Devices",
    description: "Biometric device registration, sync, auto-mapping and device attendance integration.",
    category: "time",
    defaultEnabled: false,
    planFeatureKey: "biometric",
    pagePrefixes: ["/devices"],
    apiPrefixes: ["/api/biometric-devices", "/api/sync-agent"],
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Employee expense claims, categories and reimbursement workflow.",
    category: "money",
    defaultEnabled: false,
    planFeatureKey: "expenses",
    pagePrefixes: ["/expenses", "/ess/expenses"],
    apiPrefixes: ["/api/expenses"],
  },
  {
    key: "loans",
    label: "Loans & Advances",
    description: "Employee loans, advances and deductions.",
    category: "money",
    defaultEnabled: false,
    planFeatureKey: "loans",
    pagePrefixes: ["/loans", "/ess/loans"],
    apiPrefixes: ["/api/loans"],
  },
  {
    key: "recruitment",
    label: "Recruitment",
    description: "Job posts, candidates and hiring workflow.",
    category: "talent",
    defaultEnabled: false,
    planFeatureKey: "recruitment",
    pagePrefixes: ["/recruitment"],
    apiPrefixes: ["/api/recruitment"],
  },
  {
    key: "performance",
    label: "Performance",
    description: "Goals, reviews and performance tracking.",
    category: "talent",
    defaultEnabled: false,
    planFeatureKey: "performance",
    pagePrefixes: ["/performance", "/ess/performance"],
    apiPrefixes: ["/api/performance"],
  },
  {
    key: "documents",
    label: "Documents",
    description: "Document templates, generation, previews and employee document requests.",
    category: "operations",
    defaultEnabled: false,
    planFeatureKey: "customDocuments",
    pagePrefixes: ["/documents", "/ess/documents"],
    apiPrefixes: ["/api/documents", "/api/ess/document-request"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Operational reports and summaries.",
    category: "operations",
    defaultEnabled: true,
    pagePrefixes: ["/reports"],
    apiPrefixes: ["/api/reports"],
  },
  {
    key: "advancedReports",
    label: "Advanced Reports",
    description: "Advanced analytics and premium reporting capabilities.",
    category: "operations",
    defaultEnabled: false,
    planFeatureKey: "advancedReports",
    pagePrefixes: ["/reports/advanced"],
    apiPrefixes: ["/api/reports/advanced"],
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "Company-wide announcements and employee communication.",
    category: "operations",
    defaultEnabled: true,
    pagePrefixes: ["/announcements", "/ess/announcements"],
    apiPrefixes: ["/api/announcements"],
  },
  {
    key: "approvals",
    label: "Approval Workflows",
    description: "Configurable approval workflows and delegations.",
    category: "operations",
    defaultEnabled: true,
    pagePrefixes: ["/approval-workflows", "/settings/delegations"],
    apiPrefixes: ["/api/approval-workflows", "/api/rbac/delegations"],
  },
  {
    key: "compliance",
    label: "Compliance",
    description: "Compliance dashboard and statutory checks.",
    category: "operations",
    defaultEnabled: false,
    planFeatureKey: "compliance",
    pagePrefixes: ["/compliance"],
    apiPrefixes: ["/api/compliance"],
  },
  {
    key: "auditLogs",
    label: "Audit Logs",
    description: "Security and administrative audit trail.",
    category: "platform",
    defaultEnabled: true,
    pagePrefixes: ["/audit-logs"],
    apiPrefixes: ["/api/audit-logs"],
  },
  {
    key: "apiAccess",
    label: "Public API Access",
    description: "External API keys and v1 API endpoints.",
    category: "platform",
    defaultEnabled: false,
    planFeatureKey: "apiAccess",
    pagePrefixes: ["/settings?tab=api-keys"],
    apiPrefixes: ["/api/v1", "/api/sync-agent/keys"],
  },
];

export const MODULE_BY_KEY = Object.fromEntries(
  MODULE_DEFINITIONS.map((module) => [module.key, module]),
) as Record<ModuleKey, ModuleDefinition>;

const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/verify-email",
  "/careers",
  "/suspended",
  "/deactivated",
  "/billing/upgrade",
  "/platform",
  "/auth/impersonate",
  "/legal",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/webhooks",
  "/api/health",
  "/api/cron",
  "/api/leads",
  "/api/platform",
  "/api/billing",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix.includes("?")) return pathname === prefix;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeEntitlements(features?: EntitlementFeatures | null): Record<ModuleKey, boolean> {
  const source = features || {};
  return Object.fromEntries(
    MODULE_DEFINITIONS.map((module) => {
      const explicit = source[module.key];
      const planExplicit = module.planFeatureKey ? source[module.planFeatureKey] : undefined;
      return [module.key, typeof explicit === "boolean" ? explicit : typeof planExplicit === "boolean" ? planExplicit : module.defaultEnabled];
    }),
  ) as Record<ModuleKey, boolean>;
}

export function getModuleForPath(pathname: string, kind: "page" | "api"): ModuleDefinition | null {
  const publicPrefixes = kind === "api" ? PUBLIC_API_PREFIXES : PUBLIC_PAGE_PREFIXES;
  if (publicPrefixes.some((prefix) => matchesPrefix(pathname, prefix))) return null;

  const prefixesKey = kind === "api" ? "apiPrefixes" : "pagePrefixes";
  const matches = MODULE_DEFINITIONS
    .filter((module) => module[prefixesKey].some((prefix) => matchesPrefix(pathname, prefix)))
    .sort((a, b) => {
      const longestA = Math.max(...a[prefixesKey].map((prefix) => prefix.length));
      const longestB = Math.max(...b[prefixesKey].map((prefix) => prefix.length));
      return longestB - longestA;
    });

  return matches[0] || null;
}

export function canAccessModule(features: EntitlementFeatures | null | undefined, moduleKey: ModuleKey): boolean {
  return normalizeEntitlements(features)[moduleKey] !== false;
}

export function canAccessPath(features: EntitlementFeatures | null | undefined, pathname: string, kind: "page" | "api"):
  | { allowed: true; matchedModule: null | ModuleDefinition }
  | { allowed: false; matchedModule: ModuleDefinition } {
  const matchedModule = getModuleForPath(pathname, kind);
  if (!matchedModule) return { allowed: true, matchedModule };
  const allowed = canAccessModule(features, matchedModule.key);
  return allowed ? { allowed: true, matchedModule } : { allowed: false, matchedModule };
}

export function mergePlanFeaturesWithModules(planFeatures?: EntitlementFeatures | null): Record<ModuleKey | string, boolean> {
  const normalized = normalizeEntitlements(planFeatures);
  return {
    ...(planFeatures || {}),
    ...normalized,
  };
}
