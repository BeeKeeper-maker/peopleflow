import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to dashboard or login based on auth status
  // For now, redirect to dashboard
  redirect("/dashboard");
}
