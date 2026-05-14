import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { getOrgSubscription } from "@/lib/plan-enforcement";
import { MODULE_DEFINITIONS, normalizeEntitlements } from "@/lib/module-entitlements";

export async function GET() {
  const ctx = await getApiUser();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await getOrgSubscription(ctx.organizationId);
  const features = normalizeEntitlements(subscription?.features || {});

  return NextResponse.json({
    features,
    modules: MODULE_DEFINITIONS.map((module) => ({
      key: module.key,
      label: module.label,
      description: module.description,
      category: module.category,
      enabled: features[module.key],
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          planSlug: subscription.planSlug,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEnd: subscription.trialEnd,
        }
      : null,
  });
}
