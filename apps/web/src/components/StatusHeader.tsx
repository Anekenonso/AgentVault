'use client';

import React, { useState } from 'react';
import {
  Shield,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  ShieldCheck,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { shortAddress, VAULT_CONTRACT_ID, formatTUSDC } from '../lib/stellar';
import type { VaultConfig } from '../lib/types';

interface StatusHeaderProps {
  config: VaultConfig | null;
  walletAddress: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onTogglePause: () => void;
  isActionLoading: boolean;
}

export function StatusHeader({
  config,
  walletAddress,
  onConnectWallet,
  onDisconnectWallet,
  onTogglePause,
  isActionLoading,
}: StatusHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(VAULT_CONTRACT_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPaused = config?.paused ?? false;

  return (
    <div className="bg-[#fffdf9] rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-[#e6dccb] shadow-2xs">
      {/* Background Ambient Warm Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-[#1f4d3a]/4 rounded-full blur-3xl pointer-events-none" />

      {/* Top Telemetry & Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e6dccb]">
        {/* Left: Operational Status & Contract Chip */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo size={28} />
            <span
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide ${
                isPaused
                  ? 'bg-[#f8e4db] text-[#9d3f22] border border-[#c2512f]/25'
                  : 'bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/25'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPaused ? 'bg-[#c2512f]' : 'bg-[#1f4d3a] animate-pulse'
                }`}
              />
              {isPaused ? 'KILL-SWITCH ENGAGED (PAUSED)' : 'VAULT OPERATIONAL'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-[#faf6ef] px-3.5 py-1.5 rounded-full border border-[#e6dccb] text-xs font-mono text-[#1c2621] shadow-2xs">
            <span className="text-[#7d877f] font-sans">Contract:</span>
            <span className="text-[#1c2621] font-bold">{shortAddress(VAULT_CONTRACT_ID)}</span>
            <button
              onClick={handleCopy}
              className="text-[#7d877f] hover:text-[#1c2621] transition-colors ml-1 p-0.5 rounded cursor-pointer"
              title="Copy contract ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#1f4d3a]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${VAULT_CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#1f4d3a] hover:text-[#163828] p-0.5 rounded transition-colors"
              title="View on Stellar.Expert"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Right: Authority Action Cluster */}
        <div className="flex items-center gap-3">
          {/* Emergency Kill Switch */}
          <button
            onClick={onTogglePause}
            disabled={isActionLoading || !walletAddress}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isPaused
                ? 'bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] shadow-xs'
                : 'bg-[#f8e4db] hover:bg-[#f3d2c4] text-[#9d3f22] border border-[#c2512f]/30 shadow-xs'
            }`}
            title={walletAddress ? 'Toggle emergency kill-switch on-chain' : 'Connect Owner Freighter wallet to pause'}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4 text-[#faf6ef]" />
                <span>Resume Operations</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-[#c2512f]" />
                <span>Emergency Pause</span>
              </>
            )}
          </button>

          {/* Freighter Wallet Connect — Imperial Spruce Capsule */}
          {walletAddress ? (
            <div className="flex items-center gap-2">
              {config && walletAddress === config.owner ? (
                <div className="flex items-center gap-2 bg-[#dfeae3] border border-[#1f4d3a]/25 px-3.5 py-1.5 rounded-full text-xs font-mono text-[#163828]">
                  <span className="w-2 h-2 rounded-full bg-[#1f4d3a]" />
                  <span className="font-bold text-[11px] font-sans text-[#163828] uppercase tracking-wider">Owner:</span>
                  <span>{shortAddress(walletAddress)}</span>
                  <button
                    onClick={onDisconnectWallet}
                    className="text-[10px] text-[#7d877f] hover:text-[#c2512f] ml-1 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 bg-[#faf6ef] border border-[#e6dccb] px-3.5 py-1.5 rounded-full text-xs font-mono text-[#1c2621]"
                  title={`Connected as Non-Owner. Vault Owner is ${config ? shortAddress(config.owner) : '...'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#b97d10]" />
                  <span className="font-bold text-[11px] font-sans text-[#7d877f]">Viewer:</span>
                  <span>{shortAddress(walletAddress)}</span>
                  <button
                    onClick={onDisconnectWallet}
                    className="text-[10px] text-[#7d877f] hover:text-[#c2512f] ml-1 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="flex items-center gap-2 bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-[#dfeae3]" />
              <span>Connect Freighter</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Metrics Bar */}
      <div className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Metric 1: Treasury Balance */}
        <div className="md:col-span-2 space-y-1">
          <span className="text-[11px] font-mono font-medium text-[#7d877f] uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#1f4d3a]" />
            Vault Liquid Treasury Balance
          </span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#1c2621] tracking-tight font-heading">
              {config ? formatTUSDC(config.balance) : '...'}
            </span>
            <span className="text-lg font-bold text-[#1f4d3a] font-heading">TUSDC</span>
            <span className="text-xs text-[#7d877f] font-mono">
              &bull; Stellar Classic SAC Token
            </span>
          </div>
        </div>

        {/* Metric 2: Autonomous Budget remaining */}
        <div className="bg-[#faf6ef] p-4 rounded-2xl border border-[#e6dccb] space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-[#7d877f]">
            <span className="flex items-center gap-1 font-mono uppercase tracking-wider">
              <Clock className="w-3 h-3 text-[#1f4d3a]" />
              23h Rolling Budget
            </span>
          </div>
          <div className="text-sm font-bold font-mono text-[#1c2621]">
            {config ? formatTUSDC(config.remaining_allowance) : '...'} / {config ? formatTUSDC(config.policy.daily_cap) : '20.0'} TUSDC
          </div>
          <div className="text-[10px] text-[#7d877f] font-mono">
            Per-Tx Cap: {config ? formatTUSDC(config.policy.per_tx_cap) : '5.0'} TUSDC
          </div>
        </div>

        {/* Metric 3: Invariant Security Gate */}
        <div className="bg-[#faf6ef] p-4 rounded-2xl border border-[#e6dccb] space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-[#7d877f]">
            <span className="flex items-center gap-1 font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-[#1f4d3a]" />
              Active Invariants
            </span>
            <span className="text-[10px] font-mono text-[#163828] font-bold bg-[#dfeae3] px-2 py-0.5 rounded-full border border-[#1f4d3a]/20">
              8 / 8
            </span>
          </div>
          <div className="text-sm font-bold text-[#1c2621] font-sans">
            100% Policy Bound
          </div>
          <div className="text-[10px] text-[#7d877f] font-mono">
            Queue Limit: 25 Proposals
          </div>
        </div>
      </div>
    </div>
  );
}
