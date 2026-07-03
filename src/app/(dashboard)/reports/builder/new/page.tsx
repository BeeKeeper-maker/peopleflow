"use client";

import ReportBuilder from "@/app/(dashboard)/reports/builder/[id]/page";

/**
 * /reports/builder/new — New report builder
 *
 * Renders the same ReportBuilder component with id="new" (no existing report).
 */
export default function NewReportPage() {
    return <ReportBuilder params={Promise.resolve({ id: "new" })} />;
}
