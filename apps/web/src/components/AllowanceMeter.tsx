'use client';

import React from 'react';
import { Clock, ShieldCheck, Zap, Info } from 'lucide-react';
import { formatTUSDC } from '../lib/stellar';
import type { VaultConfig } from '../lib/types';

interface AllowanceMeterProps {
  config: VaultConfig | null;
}

export function AllowanceMeter({ config }: AllowanceMeterProps) {
  if (!config) {
    return (
      <div className="glass-panel rounded-2xl p-6 sm:p-7 animate-pulse h-64" />
    );
  }

  const dailyCap = config.policy.daily_cap;
  const remaining = config.remaining_allowance;
  const spent = config.spent_in_window;
  const perTxCap = config.policy.per_tx_cap;

  const total = Number(dailyCap);
  const remNum = Number(remaining);
  const percentRemaining = total > 0 ? Math.min(100, Math.max(0, (remNum / total) * 100)) : 0;
  const percentSpent = 100 - percentRemaining;

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e6dccb]/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#dfeae3] border border-[#1f4d3a]/20 rounded-xl text-[#1f4d3a]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c2621] font-heading">Rolling 23h Allowance</h2>
              <p className="text-[11px] text-[#7d877f]">Sliding hourly window spending budget</p>
            </div>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-[#faf6ef] border border-[#e6dccb] text-[#4a564f]">
            Per-Tx Cap: <strong className="text-[#1c2621]">{formatTUSDC(perTxCap)}</strong> TUSDC
          </span>
        </div>

        {/* Budget Progress Meter */}
        <div className="space-y-3.5 mb-5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium text-[#7d877f]">Available Autonomous Spending</span>
            <div className="font-mono font-extrabold text-[#1c2621] text-lg">
              <span className="text-[#1f4d3a]">{formatTUSDC(remaining)}</span>{' '}
              <span className="text-[#7d877f] font-normal text-xs">/ {formatTUSDC(dailyCap)} TUSDC</span>
            </div>
          </div>

          {/* Luminous Dual-Color Progress Bar */}
          <div className="w-full bg-[#faf6ef] rounded-full h-3 border border-[#e6dccb] overflow-hidden p-[1px] shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                percentRemaining < 20
                  ? 'bg-[#c2512f]'
                  : percentRemaining < 50
                  ? 'bg-[#b97d10]'
                  : 'bg-[#1f4d3a]'
              }`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>

          {/* Dual Stat Tiles */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-[#faf6ef] p-3 rounded-xl border border-[#e6dccb] shadow-sm">
              <div className="text-[11px] font-mono text-[#7d877f] uppercase tracking-wider">Spent in Window</div>
              <div className="text-sm font-mono font-bold text-[#1c2621] mt-1">
                {formatTUSDC(spent)} <span className="text-[#7d877f] text-xs">TUSDC</span>
              </div>
              <div className="text-[10px] text-[#7d877f] mt-0.5">
                {percentSpent.toFixed(0)}% consumed
              </div>
            </div>
            <div className="bg-[#faf6ef] p-3 rounded-xl border border-[#e6dccb] shadow-sm">
              <div className="text-[11px] font-mono text-[#7d877f] uppercase tracking-wider">Remaining Buffer</div>
              <div className="text-sm font-mono font-bold text-[#163828] mt-1">
                {percentRemaining.toFixed(0)}% <span className="text-[#1f4d3a]/80 text-xs">available</span>
              </div>
              <div className="text-[10px] text-[#1f4d3a]/80 mt-0.5">
                Auto-replenishes hourly
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invariant Note Footer */}
      <div className="pt-3 border-t border-[#e6dccb]/70 flex items-center gap-2 text-[11px] text-[#7d877f]">
        <Clock className="w-3.5 h-3.5 text-[#1f4d3a] shrink-0" />
        <p className="pretty-text">
          <strong className="text-[#1c2621]">Invariant I3:</strong> Cumulative agent spending is strictly capped across 24 sliding hourly buckets on-chain.
        </p>
      </div>
    </div>
  );
}
