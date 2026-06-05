import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://conductor-agent.vercel.app"),
  title: "Conductor • Mantle Multi-Agent Economy",
  description: "One Conductor. Specialized ERC-8004 agents. Live research + every reasoning step permanently logged on-chain. The recognizable face of transparent multi-agent economies on Mantle.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Conductor — The Orchestrator for Verifiable AI Agents on Mantle",
    description: "High-level goals → live on-chain research → delegated ERC-8004 sub-agents → immutable DecisionLogger proofs. Built for the Mantle Turing Test Hackathon.",
    images: [{ url: "/og.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#0A0A0B] text-zinc-200">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
