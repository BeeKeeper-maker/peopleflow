import MarketingClient from "./marketing-client";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow — Enterprise Landing Page

   Keep the route as a Server Component and push interactivity into
   marketing-client.tsx. Below-the-fold sections are lazy-loaded there to keep
   the public homepage fast while preserving the premium landing experience.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MarketingPage() {
    return <MarketingClient />;
}
