import { ThemeProvider } from "@nscaledev/ui/contexts/theme-provider";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Nscale OpenAPI",
    default: "Nscale OpenAPI Specs",
  },
  description: "Canonical, public OpenAPI specs for Nscale's services.",
  icons: {
    shortcut: "/static/imgs/favicon.ico",
    apple: "/static/imgs/favicon-180.png",
    icon: "/static/imgs/favicon-32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-primary-background text-primary-content">
        <ThemeProvider attribute="class" enableSystem>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
