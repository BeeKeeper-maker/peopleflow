import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | PeopleFlow",
    description: "PeopleFlow privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
    return (
        <>
            <h1>Privacy Policy</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Last Updated: April 1, 2026
            </p>

            <hr />

            <h2>1. Introduction</h2>
            <p>
                PeopleFlow (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting the privacy and security of the personal information entrusted to us by our clients and their employees. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our enterprise Human Resource Management System (&quot;HRMS&quot;) platform and related services.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>2.1 Account Information</h3>
            <p>
                When you register for PeopleFlow, we collect your organization name, administrator contact details (name, email, phone), and billing information. This information is necessary to provision and maintain your account.
            </p>
            <h3>2.2 Employee Data</h3>
            <p>
                As an HRMS platform, PeopleFlow processes employee data on behalf of your organization ("Data Controller"). This may include names, national IDs, contact information, salary details, attendance records, leave history, and biometric device identifiers. We process this data solely as a "Data Processor" under your organization&apos;s instructions.
            </p>
            <h3>2.3 Usage Data</h3>
            <p>
                We automatically collect information about how you interact with our platform, including IP addresses, browser type, pages visited, feature usage patterns, and session duration. This data helps us improve the platform and troubleshoot issues.
            </p>

            <h2>3. How We Use Your Information</h2>
            <ul>
                <li>To provide, operate, and maintain PeopleFlow services</li>
                <li>To process payroll, attendance, leave, and compliance calculations</li>
                <li>To comply with Bangladesh Labour Act (BLA) 2006 reporting requirements</li>
                <li>To send transactional notifications (payslips, approval requests, alerts)</li>
                <li>To provide customer support and respond to inquiries</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
                <li>To generate anonymized, aggregated analytics for platform improvement</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
                We implement industry-standard security measures including AES-256 encryption for data at rest, TLS 1.3 for data in transit, row-level security for tenant isolation, and role-based access controls. Our infrastructure is monitored 24/7 with automated threat detection and incident response protocols.
            </p>

            <h2>5. Data Retention</h2>
            <p>
                We retain your organization&apos;s data for the duration of your service agreement plus 90 days. Upon account termination, all data is permanently deleted from our primary systems within 90 days and from backup systems within 180 days. You may request early deletion at any time by contacting our support team.
            </p>

            <h2>6. Third-Party Services</h2>
            <p>
                We may use carefully vetted third-party services for hosting (cloud infrastructure), email delivery, payment processing, and error monitoring. These providers are contractually obligated to maintain the same level of data protection as PeopleFlow.
            </p>

            <h2>7. Your Rights</h2>
            <p>
                Organizations and their authorized administrators have the right to access, correct, export, or delete employee data processed through PeopleFlow. All data export requests are fulfilled within 72 hours in standard formats (CSV, Excel, PDF).
            </p>

            <h2>8. Contact Us</h2>
            <p>
                For privacy-related inquiries, contact our Data Protection Officer at <strong>privacy@ailearnersbd.com</strong> or write to us at: AI Learners BD, Dhaka, Bangladesh.
            </p>
        </>
    );
}
