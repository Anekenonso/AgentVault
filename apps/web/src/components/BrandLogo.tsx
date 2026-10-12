import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'monochrome' | 'gradient';
}

export function BrandLogo({
  className = '',
  size = 32,
  showText = false,
  textSize = 'md',
  variant = 'gradient',
}: BrandLogoProps) {
  const textClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Bespoke Geometric Vault Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
      >
        <defs>
          <linearGradient id="av-shield-grad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1f4d3a" />
            <stop offset="50%" stopColor="#163828" />
            <stop offset="100%" stopColor="#1c2621" />
          </linearGradient>

          <linearGradient id="av-core-grad" x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#faf6ef" />
            <stop offset="50%" stopColor="#dfeae3" />
            <stop offset="100%" stopColor="#5b7f6a" />
          </linearGradient>

          <linearGradient id="av-accent-grad" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5b7f6a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1f4d3a" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Outer Sovereign Hexagonal Vault Crest */}
        <path
          d="M32 4L54 16V36C54 48 44 57 32 60C20 57 10 48 10 36V16L32 4Z"
          fill="#1f4d3a"
          stroke="#163828"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner Precision Security Facets */}
        <path
          d="M32 10L48 19V34C48 43 40 50.5 32 53C24 50.5 16 43 16 34V19L32 10Z"
          fill="url(#av-accent-grad)"
          stroke="#5b7f6a"
          strokeWidth="1.2"
        />

        {/* Autonomous Core: Geometric Interlocking Diamond */}
        <path
          d="M32 20L41 29L32 38L23 29L32 20Z"
          fill="url(#av-core-grad)"
        />

        {/* Central Cryptographic Keyway Anchor */}
        <circle cx="32" cy="29" r="3.2" fill="#1f4d3a" stroke="#faf6ef" strokeWidth="1.5" />

        {/* Deterministic On-Chain Invariant Latches (I1-I4) */}
        <line x1="32" y1="38" x2="32" y2="48" stroke="#c2512f" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="48" r="2" fill="#c2512f" />
      </svg>

      {/* Brand Wordmark with Sovereign Typography */}
      {showText && (
        <div className="flex items-baseline tracking-tight">
          <span className={`font-extrabold text-[#1c2621] font-heading ${textClasses[textSize]}`}>
            Agent<span className="text-[#1f4d3a]">Vault</span>
          </span>
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#163828] ml-1.5 px-2 py-0.5 rounded-full bg-[#dfeae3] border border-[#1f4d3a]/25 uppercase">
            v2
          </span>
        </div>
      )}
    </div>
  );
}
