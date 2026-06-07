import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VM-Tipset 2026",
  description: "Privat VM-tipsspel med live leaderboard, grupper och slutspelsträd.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
