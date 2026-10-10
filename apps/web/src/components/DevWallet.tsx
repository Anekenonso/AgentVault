'use client';

import React from 'react';
import { Key } from 'lucide-react';

interface DevWalletProps {
  onSelectKey: (secret: string) => void;
}

export function DevWallet({ onSelectKey }: DevWalletProps) {
  // CRITICAL SECURITY ENFORCEMENT:
  // DevWallet only mounts if explicitly enabled by test environment variable.
  // Production builds must have NEXT_PUBLIC_ENABLE_DEV_WALLET=false.
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_WALLET !== 'true') {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 my-4 text-xs font-mono">
      <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
        <Key className="w-4 h-4" />
        <span>TEST-ONLY DEV WALLET (DISABLED IN PRODUCTION)</span>
      </div>
      <p className="text-slate-400 font-sans mb-3">
        In-browser test signer active for headless CI automation.
      </p>
    </div>
  );
}
