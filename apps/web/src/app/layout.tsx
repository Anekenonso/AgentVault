import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Shield, ExternalLink, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AgentVault v2 — Autonomous AI Agent Vault on Soroban',
  description: 'Hard on-chain caps, allowlisted payees, proposal queue, and kill-switch containment for AI agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#07090e] text-slate-100 min-h-screen flex flex-col antialiased">
        <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg group-hover:border-sky-400 transition-colors">
                  <Shield className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <span className="font-bold tracking-tight text-white text-lg">AgentVault</span>
                  <span className="text-xs font-mono text-sky-400 ml-1.5 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/50">v2</span>
                </div>
              </Link>
              <nav className="hidden md:flex space-x-1">
                <Link
                  href="/"
                  className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-md transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/proof"
                  className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Proof & Red-Team
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                STELLAR TESTNET
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>AgentVault v2 — Autonomous Agent Containment & Policy Engine on Soroban</p>
            <div className="flex items-center space-x-4">
              <a
                href="https://stellar.expert/explorer/testnet/contract/CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-400 transition-colors flex items-center gap-1"
              >
                Vault Contract <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://stellar.expert/explorer/testnet/contract/CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-400 transition-colors flex items-center gap-1 text-red-400/80"
              >
                Naive Baseline <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
