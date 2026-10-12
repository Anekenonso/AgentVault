import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { BrandLogo } from '../components/BrandLogo';
import { ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AgentVault v2 — The Sovereign Policy Vault for Autonomous AI Agents',
  description:
    'AI handles ambiguity. Deterministic smart contracts handle authority. Decoupling agent intelligence from spending keys with non-bypassable on-chain invariants on Stellar Soroban.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=4' },
      { url: '/favicon-32x32.png?v=4', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=4', sizes: '16x16', type: 'image/png' },
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico?v=4',
    apple: '/apple-touch-icon.png?v=4',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="shortcut icon" href="/favicon.ico?v=4" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg?v=4" />
        <link rel="alternate icon" href="/favicon.ico?v=4" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4" />
      </head>
      <body className="min-h-screen flex flex-col antialiased bg-[#faf6ef] text-[#1c2621] selection:bg-[#1f4d3a]/15 selection:text-[#1f4d3a]">
        {/* Floating Ivory Frosted Header */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>

        {/* Global Sovereign Brand Footer */}
        <footer className="border-t border-[#e6dccb] bg-[#fffdf9] py-10 text-center text-xs text-[#7d877f]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-left">
              <BrandLogo size={28} showText={true} textSize="sm" />
              <span className="text-[#cfc2ab] hidden sm:inline">&bull;</span>
              <p className="text-xs text-[#4a564f] font-sans pretty-text">
                Autonomous AI Agent Containment & Sovereign Policy Engine on Stellar Soroban
              </p>
            </div>

            <div className="flex items-center space-x-6 font-mono text-[11px]">
              <a
                href="https://stellar.expert/explorer/testnet/contract/CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1f4d3a] transition-colors flex items-center gap-1.5 text-[#4a564f]"
              >
                <span>Vault Contract</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#1f4d3a]" />
              </a>
              <a
                href="https://stellar.expert/explorer/testnet/contract/CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#c2512f] transition-colors flex items-center gap-1.5 text-[#9d3f22]"
              >
                <span>Naive Baseline</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#c2512f]" />
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
