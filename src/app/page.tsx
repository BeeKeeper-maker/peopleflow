import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import MarketingPage from "./(marketing)/page";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  // Authenticated users go to their role-appropriate dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // Unauthenticated users see the marketing landing page
  return <MarketingPage />;
}
