import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Cookie Policy | PeopleFlow",
    description: "PeopleFlow cookie policy — how we use cookies and similar technologies.",
};

export default function CookiePolicyPage() {
    return (
        <>
            <h1>Cookie Policy</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Last Updated: April 1, 2026
            </p>

            <hr />

            <h2>1. What Are Cookies</h2>
            <p>
                Cookies are small text files stored on your device when you visit a website. They help us provide you with a better experience by remembering your preferences, maintaining your session, and understanding how you use our platform.
            </p>

            <h2>2. Cookies We Use</h2>

            <h3>2.1 Essential Cookies</h3>
            <p>
                These cookies are strictly necessary for PeopleFlow to function. They include authentication tokens, session identifiers, and CSRF protection tokens. Without these cookies, the Service cannot operate. These cookies cannot be disabled.
            </p>

            <h3>2.2 Functional Cookies</h3>
            <p>
                These cookies remember your preferences such as language settings, dashboard layout, and notification preferences. They enhance your experience but are not strictly necessary for the Service to function.
            </p>

            <h3>2.3 Analytics Cookies</h3>
            <p>
                We use analytics cookies to understand how users interact with our platform — which features are most used, where users encounter friction, and how we can improve the experience. This data is aggregated and anonymized. We use Sentry for error monitoring and performance tracking.
            </p>

            <h2>3. Third-Party Cookies</h2>
            <p>
                PeopleFlow does not use third-party advertising cookies. We do not sell or share cookie data with advertising networks. The only third-party cookies are those set by our essential service providers (authentication, error monitoring).
            </p>

            <h2>4. Managing Cookies</h2>
            <p>
                You can control and delete cookies through your browser settings. Please note that disabling essential cookies will prevent you from using PeopleFlow. Most browsers allow you to:
            </p>
            <ul>
                <li>View what cookies are stored on your device</li>
                <li>Delete individual or all cookies</li>
                <li>Block cookies from specific or all websites</li>
                <li>Set preferences for first-party vs third-party cookies</li>
            </ul>

            <h2>5. Cookie Retention</h2>
            <p>
                Session cookies are deleted when you close your browser. Persistent cookies (such as &quot;remember me&quot; tokens) are retained for up to 30 days. Analytics cookies are retained for up to 12 months.
            </p>

            <h2>6. Contact</h2>
            <p>
                For questions about our cookie practices, contact us at <strong>privacy@ailearnersbd.com</strong>.
            </p>
        </>
    );
}
