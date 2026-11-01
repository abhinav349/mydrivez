import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700", "800"] });

const appUrl = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "MyDrivez — Premium self-drive car rentals", template: "%s · MyDrivez" },
  description:
    "Experience the freedom of self-drive car rentals. Verified cars, transparent pricing and flexible bookings across Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune and Goa.",
  keywords: ["self drive car rental", "car rental India", "rent a car Bengaluru", "SUV rental", "luxury car rental", "MyDrivez"],
  openGraph: {
    type: "website",
    siteName: "MyDrivez",
    title: "MyDrivez — Your Journey. Your Rules. Your Drive.",
    description: "Find your perfect ride, book in minutes, and hit the road.",
    images: ["/photos/hero.jpg"],
  },
  twitter: { card: "summary_large_image" },
  authors: [{ name: "OwnWebify", url: "https://ownwebify.com" }],
  creator: "OwnWebify",
  publisher: "OwnWebify",
};

export const viewport: Viewport = {
  themeColor: "#101820",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-line !shadow-lift !font-sans",
              title: "!font-semibold !text-ink",
            },
          }}
        />
      </body>
    </html>
  );
}
