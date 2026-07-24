import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nscale OpenAPI Specs",
  description: "Canonical, public OpenAPI specs for Nscale's services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
