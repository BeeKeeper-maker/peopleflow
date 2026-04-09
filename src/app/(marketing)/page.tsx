"use client";

import { useState } from "react";
import { P, GlobalKeyframes } from "./_components/shared";
import Navbar from "./_components/navbar";
import HeroCinematic from "./_components/hero";
import LogoMarquee from "./_components/logo-marquee";
import PainSection from "./_components/pain-section";
import TrustBadgesSection from "./_components/trust-badges";
import BentoFeatures from "./_components/bento-features";
import ComplianceDeepDive from "./_components/compliance-deep-dive";
import Testimonials from "./_components/testimonials";
import PricingTheater from "./_components/pricing-theater";
import CTAFinal from "./_components/cta-final";
import FooterEnterprise from "./_components/footer";
import DemoModal from "./_components/demo-modal";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow — Enterprise Landing Page v5.0 (Final Assembly)
   12-Section God-Tier Architecture

   01. Navbar (glassmorphism, shimmer CTA)
   02. Hero Cinematic (aurora mesh, 3D dashboard, gradient text)
   03. Logo Marquee (infinite scroll, BD industry logos)
   04. Pain Section (FOMO engine, 3 danger cards)
   05. Trust Badges (4 enterprise credibility badges)
   06. Bento Features (6 engines, 3D tilt, live micro-UIs)
   07. Compliance Deep-Dive (interactive BLA 2006 explorer)
   08. Testimonials (social proof carousel)
   09. Pricing Theater (3-tier, monthly/annual toggle)
   10. CTA Final (urgency close, aurora background)
   11. Footer (enterprise, 4-column)
   12. Demo Modal (lead capture overlay)
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MarketingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <main className="min-h-screen" style={{ background: P.bg, color: "white" }}>
            <GlobalKeyframes />

            {/* 01 */ } <Navbar onBookDemo={openDemo} />
            {/* 02 */ } <HeroCinematic onBookDemo={openDemo} />
            {/* 03 */ } <LogoMarquee />
            {/* 04 */ } <PainSection />
            {/* 05 */ } <TrustBadgesSection />
            {/* 06 */ } <BentoFeatures />
            {/* 07 */ } <ComplianceDeepDive />
            {/* 08 */ } <Testimonials />
            {/* 09 */ } <PricingTheater onBookDemo={openDemo} />
            {/* 10 */ } <CTAFinal onBookDemo={openDemo} />
            {/* 11 */ } <FooterEnterprise />

            {/* 12 */ } <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
    );
}
