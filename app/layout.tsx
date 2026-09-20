import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schengen Tracker",
  description: "Track your trips and plan your Schengen days with the 90/180-day calculator.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
