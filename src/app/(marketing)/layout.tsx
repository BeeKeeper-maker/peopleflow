import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";

// ═══════════════════════════════════════════════════════════════
// FONTS — Dark Refinement typography stack
//   Inter        → body
//   Inter Tight  → display headings (tight tracking)
//   JetBrains Mono → stats, code, numbers
// ═══════════════════════════════════════════════════════════════

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PeopleFlow | Enterprise HR, Engineered for Bangladesh",
  description:
    "HRMS for Bangladesh-focused teams with payroll, attendance, leave, approvals, and compliance-oriented workflows for beta evaluation.",
  keywords: [
    "HRMS Bangladesh",
    "HR Software Bangladesh",
    "Payroll Software BD",
    "BLA 2006 Compliance",
    "Bangladesh Labor Act",
    "RMG HR Software",
    "Employee Management System",
    "PeopleFlow",
    "Festival Bonus Automation",
    "Biometric Attendance Bangladesh",
  ],
  openGraph: {
    title: "PeopleFlow | Enterprise HR, Engineered for Bangladesh",
    description:
      "HRMS for Bangladesh-focused teams with payroll, attendance, leave, approvals, and compliance-oriented workflows.",
    type: "website",
    siteName: "PeopleFlow",
    url: "https://hr.ailearnersbd.com",
  },
  alternates: {
    canonical: "https://hr.ailearnersbd.com",
  },
};

// Structured Data (JSON-LD)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "PeopleFlow",
      url: "https://hr.ailearnersbd.com",
      logo: "https://hr.ailearnersbd.com/icon.png",
      description:
        "Enterprise HR Management System engineered for Bangladesh-focused teams with payroll, attendance, leave, and approval workflows.",
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      name: "PeopleFlow HRMS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "2999",
        highPrice: "7999",
        priceCurrency: "BDT",
        offerCount: "3",
      },
    },
  ],
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-sans: ${inter.style.fontFamily};
          --font-display: ${interTight.style.fontFamily};
          --font-mono: ${jetbrainsMono.style.fontFamily};
        }
        html, body {
          font-family: var(--font-sans), system-ui, sans-serif;
          background: #0A0A0F;
          color: #F5F5F7;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        .font-display {
          font-family: var(--font-display), system-ui, sans-serif;
        }
        .font-mono {
          font-family: var(--font-mono), ui-monospace, monospace;
        }
      `}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}>
        {children}
      </div>
    </>
  );
}
