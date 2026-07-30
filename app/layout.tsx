import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./_components/Navbar";
import AppMain from "./_components/AppMain";
import EnergySync from "./_components/EnergySync";
import OnboardingGate from "./_components/OnboardingGate";
import ScrollToTop from "./_components/ScrollToTop";
import ServiceWorkerManager from "./_components/ServiceWorkerManager";
import OfflineDataGuard from "./_components/OfflineDataGuard";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "./_lib/languageContext";
import { StartPlayingModalProvider } from "./_components/StartPlayingModalProvider";
import DuelInviteListener from "./_components/DuelInviteListener";
import { auth } from "@/auth";
import { SessionProvider } from "@/lib/auth-client";
import SiteTranslationBridge from "./_components/SiteTranslationBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "KatchUp",
  // No `template`: the pages that set their own title already brand it, and a
  // suffix here would make them read "Blog — KatchUp · KatchUp".
  title: "KatchUp — learn words that stick",
  description:
    "Practice vocabulary in short rounds, race your friends, and keep your streak — online or off.",
  // The App Router serves app/manifest.ts here and links it on every page.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS ignores the manifest's display mode; this is what makes an installed
  // KatchUp open without Safari's chrome there.
  appleWebApp: {
    capable: true,
    title: "KatchUp",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` lets the app paint under the notch and home indicator;
  // the safe-area padding that makes that legible lives in globals.css.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          enableColorScheme
        >
          <SessionProvider session={session} refetchOnWindowFocus={false}>
            <LanguageProvider>
              <SiteTranslationBridge />
              <StartPlayingModalProvider>
                <ScrollToTop />
                <ServiceWorkerManager />
                <OfflineDataGuard />
                <EnergySync />
                <DuelInviteListener />
                <Navbar />
                <AppMain>
                  <OnboardingGate>{children}</OnboardingGate>
                </AppMain>
              </StartPlayingModalProvider>
            </LanguageProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
