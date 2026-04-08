"use client";

import { useState } from "react";
import { P } from "./_components/shared";
import Navbar from "./_components/navbar";
import HeroSection from "./_components/hero";
import { CostOfInaction, TrustBadges, StatsBanner } from "./_components/trust-sections";
import BentoFeatures from "./_components/bento-features";
import { WhySection, PricingSection, CTASection, Footer } from "./_components/bottom-sections";
import DemoModal from "./_components/demo-modal";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow — Enterprise Landing Page v3.0
   Aesthetic: Vercel/Linear Dark × Gradient Mesh × Framer Motion
   Target: B2B Enterprise (RMG, Corporate, NGO) — Bangladesh
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MarketingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <main className="min-h-screen" style={{ background: P.bg, color: "white" }}>
            <style jsx global>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
            `}</style>

            <Navbar onBookDemo={openDemo} />
            <HeroSection onBookDemo={openDemo} />
            <StatsBanner />
            <CostOfInaction />
            <TrustBadges />
            <BentoFeatures />
            <WhySection />
            <PricingSection onBookDemo={openDemo} />
            <CTASection onBookDemo={openDemo} />
            <Footer />

            {/* Demo Modal — Global */}
            <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
    );
}
