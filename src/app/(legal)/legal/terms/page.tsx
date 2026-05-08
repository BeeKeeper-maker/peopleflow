import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | PeopleFlow",
    description: "PeopleFlow terms of service — the agreement governing your use of our HRMS platform.",
};

export default function TermsOfServicePage() {
    return (
        <>
            <h1>Terms of Service</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Last Updated: April 1, 2026
            </p>

            <hr />

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing or using PeopleFlow (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you are entering into these Terms on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
            </p>

            <h2>2. Service Description</h2>
            <p>
                PeopleFlow is a cloud-based enterprise Human Resource Management System (HRMS) designed for organizations operating in Bangladesh. The Service includes employee management, attendance tracking, payroll processing, leave management, compliance-oriented review workflows, and related workforce management capabilities.
            </p>

            <h2>3. Account Registration</h2>
            <p>
                You must provide accurate and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.
            </p>

            <h2>4. Subscription & Billing</h2>
            <p>
                PeopleFlow offers tiered subscription plans (Starter, Growth, Enterprise). Fees are billed monthly or annually as selected. All fees are non-refundable except as required by law. We reserve the right to modify pricing with 30 days&apos; prior notice.
            </p>

            <h2>5. Data Ownership</h2>
            <p>
                You retain full ownership of all data you upload, create, or process through PeopleFlow. We do not claim ownership over your content. We process your data solely to deliver the Service and in accordance with our Privacy Policy.
            </p>

            <h2>6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any systems or data</li>
                <li>Reverse-engineer, decompile, or disassemble the Service</li>
                <li>Resell or sublicense the Service without written consent</li>
                <li>Upload malicious code or interfere with Service operations</li>
            </ul>

            <h2>7. Service Level Agreement (SLA)</h2>
            <p>
                During beta, PeopleFlow is provided without a guaranteed uptime SLA unless a separate written agreement states otherwise. Production SLA terms may be introduced for paid plans after beta validation.
            </p>

            <h2>8. Limitation of Liability</h2>
            <p>
                To the maximum extent permitted by law, PeopleFlow&apos;s total liability for any claims arising from or relating to these Terms or the Service shall not exceed the total fees paid by you in the 12 months preceding the claim.
            </p>

            <h2>9. Termination</h2>
            <p>
                Either party may terminate this agreement with 30 days&apos; written notice. Upon termination, your access to the Service will cease, and your data will be retained for 90 days before permanent deletion. You may request a full data export prior to termination.
            </p>

            <h2>10. Governing Law</h2>
            <p>
                These Terms shall be governed by and construed in accordance with the laws of the People&apos;s Republic of Bangladesh. Any disputes shall be resolved through arbitration in Dhaka, Bangladesh.
            </p>

            <h2>11. Contact</h2>
            <p>
                For questions about these Terms, contact us at <strong>legal@ailearnersbd.com</strong>.
            </p>
        </>
    );
}
