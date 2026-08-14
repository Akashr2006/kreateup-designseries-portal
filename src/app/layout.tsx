import type { Metadata, Viewport } from "next";

import { ThemeProvider, themeBootScript } from "@/components/ui/Theme";
import { ToastProvider } from "@/components/ui/Toast";

import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "KreateUp DesignSeries Portal";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Attendance, worklogs, sprint tasks, gate passes and programme analytics for the KreateUp DesignSeries cohort.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: "DesignSeries", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint — no flash on reload. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/*
          Roboto — Google's own UI typeface, Apache 2.0 licensed and therefore
          free to ship. Google Sans / Product Sans are deliberately NOT used:
          they are proprietary to Google and not licensed for third parties.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[10px] focus:bg-[var(--color-brand-blue)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
