'use client';

import React from 'react';
import { Clock, ShieldCheck, Zap } from 'lucide-react';
import { formatTUSDC } from '../lib/stellar';
import type { VaultConfig } from '../lib/types';

interface AllowanceMeterProps {
  config: VaultConfig | null;
}

export function AllowanceMeter({ config }: AllowanceMeterProps) {
  if (!config) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse h-48" />
    );
  }

  const dailyCap = config.policy.daily_cap;
  const remaining = config.remaining_allowance;
  const spent = config.spent_in_window;
  const perTxCap = config.policy.per_tx_cap;

  const total = Number(dailyCap);
  const remNum = Number(remaining);
  const percentRemaining = total > 0 ? Math.min(100, Math.max(0, (remNum / total) * 100)) : 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white">Agent Allowance Engine</h2>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Per-Tx Cap: {formatTUSDC(perTxCap)} TUSDC
          </span>
        </div>

        {/* Progress Display */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-slate-400">Rolling 23-Hour Window Remaining:</span>
            <span className="font-mono font-bold text-white text-base">
              {formatTUSDC(remaining)}{' '}
              <span className="text-slate-500 font-normal">/ {formatTUSDC(dailyCap)} TUSDC</span>
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentRemaining < 20
                  ? 'bg-rose-500'
                  : percentRemaining < 50
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-sky-500 to-emerald-400'
              }`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 font-mono">
            <span>Spent in window: {formatTUSDC(spent)} TUSDC</span>
            <span>{percentRemaining.toFixed(1)}% Available</span>
          </div>
        </div>
      </div>

      {/* Rolling bucket note */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
        <Clock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p>
          Enforces invariant <strong className="text-slate-200">I3</strong>: sum of all auto-payments across any rolling 23-hour window
          is strictly bounded by <span className="font-mono text-sky-300">{formatTUSDC(dailyCap)} TUSDC</span> via on-chain persistent hourly buckets.
        </p>
      </div>
    </div>
  );
}
