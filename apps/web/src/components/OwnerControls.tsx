'use client';

import React, { useState } from 'react';
import { Settings, Shield, UserCheck, Plus, Check, ExternalLink } from 'lucide-react';
import { shortAddress, VAULT_CONTRACT_ID } from '../lib/stellar';
import type { VaultConfig } from '../lib/types';

interface OwnerControlsProps {
  config: VaultConfig | null;
  walletAddress: string | null;
}

export function OwnerControls({ config, walletAddress }: OwnerControlsProps) {
  const [activeTab, setActiveTab] = useState<'allowlist' | 'policy' | 'agent'>('allowlist');

  if (!config) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Owner Authority Console</h2>
            <p className="text-xs text-slate-400">
              Only the Owner key ({shortAddress(config.owner)}) can invoke these state changes
            </p>
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('allowlist')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'allowlist' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Allowlist ({config.allowlist.length})
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'policy' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Policy Engine
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'agent' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Agent Session Key
          </button>
        </div>
      </div>

      {activeTab === 'allowlist' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Allowlisted payees can receive auto-executed micro-payments within policy caps. Non-allowlisted recipients require manual owner sign-off.
          </p>
          <div className="space-y-2">
            {config.allowlist.map((addr, idx) => (
              <div
                key={addr}
                className="flex items-center justify-between bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">#{idx + 1}</span>
                  <span className="text-white">{addr}</span>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <span>Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Per-Transaction Cap</span>
            <div className="text-lg font-bold text-white">
              {Number(config.policy.per_tx_cap) / 1e7} TUSDC
            </div>
            <p className="text-slate-500 font-sans text-[11px]">
              Single payment threshold for auto-execution
            </p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Rolling 23-Hour Cap</span>
            <div className="text-lg font-bold text-white">
              {Number(config.policy.daily_cap) / 1e7} TUSDC
            </div>
            <p className="text-slate-500 font-sans text-[11px]">
              Cumulative ceiling enforced across 24 sliding hourly buckets
            </p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Proposal Queue TTL</span>
            <div className="text-lg font-bold text-white">
              {Number(config.policy.proposal_ttl_secs)} seconds (1 hour)
            </div>
            <p className="text-slate-500 font-sans text-[11px]">
              Unapproved pending proposals expire after this duration
            </p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Max Pending Capacity</span>
            <div className="text-lg font-bold text-white">25 Proposals</div>
            <p className="text-slate-500 font-sans text-[11px]">
              Hard storage DoS bound (returns Error #6 if exceeded)
            </p>
          </div>
        </div>
      )}

      {activeTab === 'agent' && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">Authorized Agent Key:</span>
            <span className="text-sky-300 font-bold">{config.agent}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">Privilege Level:</span>
            <span className="text-emerald-400 font-semibold">Proposer Only (Zero Vault Funds)</span>
          </div>
          <p className="text-slate-400 font-sans text-[11px] pt-2 border-t border-slate-900">
            The agent key holds only fee XLM for transaction submission. It has zero capability to invoke owner functions or withdraw funds.
          </p>
        </div>
      )}
    </div>
  );
}
