"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { P, GlobalKeyframes } from "./_components/shared";
import Navbar from "./_components/navbar";
import HeroCinematic from "./_components/hero";
import CTAFinal from "./_components/cta-final";
import FooterEnterprise from "./_components/footer";

const LogoMarquee = dynamic(() => import("./_components/logo-marquee"), {
    ssr: false,
    loading: () => <SectionSkeleton height="h-36" />,
});
const PainSection = dynamic(() => import("./_components/pain-section"), {
    ssr: false,
    loading: () => <SectionSkeleton />,
});
const TrustBadgesSection = dynamic(() => import("./_components/trust-badges"), {
    ssr: false,
    loading: () => <SectionSkeleton />,
});
const BentoFeatures = dynamic(() => import("./_components/bento-features"), {
    ssr: false,
    loading: () => <SectionSkeleton height="h-[520px]" />,
});
const ComplianceDeepDive = dynamic(() => import("./_components/compliance-deep-dive"), {
    ssr: false,
    loading: () => <SectionSkeleton height="h-[520px]" />,
});
const Testimonials = dynamic(() => import("./_components/testimonials"), {
    ssr: false,
    loading: () => <SectionSkeleton />,
});
const PricingTheater = dynamic(() => import("./_components/pricing-theater"), {
    ssr: false,
    loading: () => <SectionSkeleton height="h-[620px]" />,
});
const DemoModal = dynamic(() => import("./_components/demo-modal"), {
    ssr: false,
});

function SectionSkeleton({ height = "h-64" }: { height?: string }) {
    return (
        <section className={`mx-auto w-full max-w-7xl px-6 py-12 ${height}`} aria-hidden="true">
            <div
                className="h-full rounded-[2rem] border border-white/5 bg-white/[0.02]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
            />
        </section>
    );
}

export default function MarketingClient() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <main className="min-h-screen" style={{ background: P.bg, color: "white" }}>
            <GlobalKeyframes />

            <Navbar onBookDemo={openDemo} />
            <HeroCinematic onBookDemo={openDemo} />

            <LogoMarquee />
            <PainSection />
            <TrustBadgesSection />
            <BentoFeatures />
            <ComplianceDeepDive />
            <Testimonials />
            <PricingTheater onBookDemo={openDemo} />
            <CTAFinal onBookDemo={openDemo} />
            <FooterEnterprise />

            {demoOpen ? <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} /> : null}
        </main>
    );
}
