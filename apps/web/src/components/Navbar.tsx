'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from './BrandLogo';
import { Activity, LayoutDashboard, ArrowUpRight } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const isDashboard = pathname === '/';
  const isProof = pathname.startsWith('/proof');

  return (
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#fffdf9]/90 border-b border-[#e6dccb] shadow-[0_2px_15px_rgba(28,38,33,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Mark with Bespoke Emblem */}
        <div className="flex items-center space-x-6 sm:space-x-8">
          <Link href="/" className="flex items-center group cursor-pointer">
            <BrandLogo size={34} showText={true} textSize="md" />
          </Link>

          {/* Institutional Capsule Navigation */}
          <nav className="flex items-center space-x-1 p-1 bg-[#faf6ef] rounded-full border border-[#e6dccb] shadow-inner">
            <Link
              href="/"
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                isDashboard
                  ? 'bg-[#fffdf9] text-[#1c2621] font-bold shadow-2xs border border-[#e6dccb]'
                  : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
              }`}
            >
              <LayoutDashboard className={`w-3.5 h-3.5 ${isDashboard ? 'text-[#1f4d3a]' : 'text-[#7d877f]'}`} />
              <span>Command Center</span>
            </Link>
            <Link
              href="/proof"
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                isProof
                  ? 'bg-[#fffdf9] text-[#1c2621] font-bold shadow-2xs border border-[#e6dccb]'
                  : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${isProof ? 'text-[#1f4d3a]' : 'text-[#7d877f]'}`} />
              <span>Empirical Proof</span>
              {isProof && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#1f4d3a] animate-pulse ml-0.5" />
              )}
            </Link>
          </nav>
        </div>

        {/* Network & Live Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/25 shadow-xs">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1f4d3a] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1f4d3a]" />
            </span>
            <span className="tracking-wide">STELLAR TESTNET &bull; P29</span>
          </div>
        </div>
      </div>
    </header>
  );
}
