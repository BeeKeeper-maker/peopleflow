import type { Metadata } from "next";

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
