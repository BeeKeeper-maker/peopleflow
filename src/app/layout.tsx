import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/providers";
import { PWARegister } from "@/components/pwa/register";

// Force dynamic rendering for all pages to avoid SSG issues with client components
export const dynamic = "force-dynamic";
export const revalidate = 0;

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#3B82F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "PeopleFlow | HR Management System",
  description: "World-class HR Management System for modern organizations. Manage employees, attendance, payroll, leave, and more with a beautiful dark theme interface.",
  keywords: ["HRMS", "HR Software", "Employee Management", "Payroll", "Attendance", "Leave Management", "Bangladesh"],
  authors: [{ name: "PeopleFlow Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PeopleFlow",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "PeopleFlow | HR Management System",
    description: "World-class HR Management System for modern organizations",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <PWARegister />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
