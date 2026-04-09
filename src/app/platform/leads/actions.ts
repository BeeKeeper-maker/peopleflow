/**
 * Lead CRM Server Actions — /platform/leads
 *
 * Secure Next.js Server Actions for updating SalesLead records.
 * All mutations require platform admin authentication.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { verifyPlatformCookie } from "@/lib/platform-token";
import { logPlatformAction } from "@/lib/platform-auth";
import { revalidatePath } from "next/cache";

// ── Valid status transitions ─────────────────────────────────────
const VALID_STATUSES = [
    "new",
    "contacted",
    "qualified",
    "demo_scheduled",
    "converted",
    "lost",
] as const;

type LeadStatus = (typeof VALID_STATUSES)[number];

// ── Update Lead Status ───────────────────────────────────────────
export async function updateLeadStatus(leadId: string, newStatus: string) {
    const session = await verifyPlatformCookie();
    if (!session) {
        return { error: "Unauthorized: Platform admin authentication required" };
    }

    if (!VALID_STATUSES.includes(newStatus as LeadStatus)) {
        return { error: `Invalid status: ${newStatus}` };
    }

    try {
        const lead = await prisma.salesLead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            return { error: "Lead not found" };
        }

        const oldStatus = lead.status;

        await prisma.salesLead.update({
            where: { id: leadId },
            data: { status: newStatus },
        });

        // Audit trail
        await logPlatformAction({
            adminId: session.id,
            action: "lead.status_updated",
            targetType: "SalesLead",
            targetId: leadId,
            metadata: {
                oldStatus,
                newStatus,
                leadName: lead.name,
                leadCompany: lead.companyName,
            },
        });

        revalidatePath("/platform/leads");
        return { success: true, oldStatus, newStatus };
    } catch (error) {
        console.error("[Lead Status Update Error]", error);
        return { error: "Failed to update lead status" };
    }
}

// ── Delete Lead ──────────────────────────────────────────────────
export async function deleteLead(leadId: string) {
    const session = await verifyPlatformCookie();
    if (!session) {
        return { error: "Unauthorized" };
    }

    try {
        const lead = await prisma.salesLead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            return { error: "Lead not found" };
        }

        await prisma.salesLead.delete({ where: { id: leadId } });

        await logPlatformAction({
            adminId: session.id,
            action: "lead.deleted",
            targetType: "SalesLead",
            targetId: leadId,
            metadata: {
                leadName: lead.name,
                leadEmail: lead.email,
                leadCompany: lead.companyName,
            },
        });

        revalidatePath("/platform/leads");
        return { success: true };
    } catch (error) {
        console.error("[Lead Delete Error]", error);
        return { error: "Failed to delete lead" };
    }
}
