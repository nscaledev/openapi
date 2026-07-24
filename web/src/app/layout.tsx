import { ThemeProvider } from "@nscaledev/ui/contexts/theme-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Nscale OpenAPI",
    default: "Nscale OpenAPI Specs",
  },
  description: "Canonical, public OpenAPI specs for Nscale's services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-nscale-background text-primary-content">
        <ThemeProvider attribute="class" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
