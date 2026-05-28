import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AnimePahe Simple",
  description: "Minimal AnimePahe API wrapper for Vercel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
