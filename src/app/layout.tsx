import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x4 Weekly",
  description: "Team weekly planning & meeting tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
