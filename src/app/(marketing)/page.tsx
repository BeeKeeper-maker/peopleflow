"use client";

import { useState } from "react";
import { P, GlobalKeyframes } from "./_components/shared";
import Navbar from "./_components/navbar";
import HeroCinematic from "./_components/hero";
import { CostOfInaction, TrustBadges, StatsBanner } from "./_components/trust-sections";
import BentoFeatures from "./_components/bento-features";
import { WhySection, PricingSection, CTASection, Footer } from "./_components/bottom-sections";
import DemoModal from "./_components/demo-modal";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow — Enterprise Landing Page v4.0 (100x Rebuild)
   Aesthetic: Aceternity × Linear × Stripe Dark
   Target: B2B Enterprise (RMG, Corporate, NGO) — Bangladesh
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MarketingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <main className="min-h-screen" style={{ background: P.bg, color: "white" }}>
            <GlobalKeyframes />
            <Navbar onBookDemo={openDemo} />
            <HeroCinematic onBookDemo={openDemo} />
            <StatsBanner />
            <CostOfInaction />
            <TrustBadges />
            <BentoFeatures />
            <WhySection />
            <PricingSection onBookDemo={openDemo} />
            <CTASection onBookDemo={openDemo} />
            <Footer />
            <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
    );
}
