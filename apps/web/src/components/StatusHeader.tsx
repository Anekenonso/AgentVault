'use client';

import React, { useState } from 'react';
import { Shield, PauseCircle, PlayCircle, ExternalLink, Copy, Check, Wallet } from 'lucide-react';
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Vault Identity & Balance */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isPaused
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 mr-2 rounded-full ${
                  isPaused ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              {isPaused ? 'KILL-SWITCH ENGAGED (PAUSED)' : 'VAULT OPERATIONAL'}
            </span>

            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800 text-xs font-mono text-slate-300">
              <span className="text-slate-500">Contract:</span>
              <span>{shortAddress(VAULT_CONTRACT_ID)}</span>
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-white transition-colors"
                title="Copy address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${VAULT_CONTRACT_ID}`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              {config ? formatTUSDC(config.balance) : '...'}
            </h1>
            <span className="text-lg font-semibold text-slate-400">TUSDC</span>
            <span className="text-xs text-slate-500 font-mono">
              (Soroban SAC Token)
            </span>
          </div>
        </div>

        {/* Right: Actions & Wallet */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Prominent Kill Switch */}
          <button
            onClick={onTogglePause}
            disabled={isActionLoading || !walletAddress}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40 hover:scale-[1.02] active:scale-[0.98]'
            } disabled:opacity-50 disabled:pointer-events-none`}
            title={walletAddress ? 'Toggle on-chain Pause kill-switch' : 'Connect Owner Freighter wallet to pause'}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                Unpause Vault
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                EMERGENCY KILL-SWITCH
              </>
            )}
          </button>

          {/* Freighter Wallet Connect */}
          {walletAddress ? (
            <div className="flex items-center gap-2">
              {config && walletAddress === config.owner ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-mono text-emerald-300 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold">Owner:</span>
                  <span>{shortAddress(walletAddress)}</span>
                  <button
                    onClick={onDisconnectWallet}
                    className="text-[11px] text-emerald-400/60 hover:text-rose-400 ml-2"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-mono text-amber-300 shadow-sm"
                  title={`Connected as Non-Owner. Vault Owner is ${config ? shortAddress(config.owner) : '...'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-bold">Viewer:</span>
                  <span>{shortAddress(walletAddress)}</span>
                  <button
                    onClick={onDisconnectWallet}
                    className="text-[11px] text-amber-400/60 hover:text-rose-400 ml-2"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-sky-950/40"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
