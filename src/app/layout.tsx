import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  themeColor: "#3B82F6",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

// Inline script to prevent flash of wrong theme (runs before React hydrates)
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('peopleflow-theme') || 'dark';
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    } catch(e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale === 'bn' ? 'bn-BD' : 'en'} className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --font-sans: ${inter.style.fontFamily};
              --font-display: ${interTight.style.fontFamily};
              --font-mono: ${jetbrainsMono.style.fontFamily};
            }
            .font-display {
              font-family: var(--font-display), system-ui, sans-serif;
              letter-spacing: -0.02em;
            }
            .font-mono {
              font-family: var(--font-mono), ui-monospace, monospace;
            }
            .tabular-nums {
              font-variant-numeric: tabular-nums;
              font-family: var(--font-mono), var(--font-sans), monospace;
            }
          `
        }} />
      </head>
      <body className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <LocaleProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </LocaleProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
