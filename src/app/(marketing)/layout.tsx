import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PeopleFlow | Enterprise HR, Engineered for Bangladesh",
  description:
    "The only HRMS with BLA 2006 compliance, automated festival bonuses, 3-tier biometric resilience, and stateful multi-level approvals. Built for RMG, Corporate, and NGO sectors in Bangladesh.",
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
      "The only HRMS with BLA 2006 compliance, automated festival bonuses, and 3-tier biometric resilience.",
    type: "website",
    siteName: "PeopleFlow",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
