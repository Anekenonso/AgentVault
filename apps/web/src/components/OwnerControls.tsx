'use client';

import React, { useState } from 'react';
import { Settings, Shield, UserCheck, Plus, Check, ExternalLink, Copy, Sliders, Key } from 'lucide-react';
import { shortAddress, VAULT_CONTRACT_ID } from '../lib/stellar';
import type { VaultConfig } from '../lib/types';

interface OwnerControlsProps {
  config: VaultConfig | null;
  walletAddress: string | null;
}

export function OwnerControls({ config, walletAddress }: OwnerControlsProps) {
  const [activeTab, setActiveTab] = useState<'allowlist' | 'policy' | 'agent'>('allowlist');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  if (!config) return null;

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-7 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6dccb]/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#dfeae3] border border-[#1f4d3a]/25 rounded-xl text-[#1f4d3a]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1c2621] font-heading">Owner Authority & Governance</h2>
            <p className="text-xs text-[#7d877f]">
              Only the sovereign Owner key (<span className="font-mono text-[#1f4d3a] font-semibold">{shortAddress(config.owner)}</span>) can execute these state mutations
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#faf6ef] p-1 rounded-xl border border-[#e6dccb] text-xs">
          <button
            onClick={() => setActiveTab('allowlist')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
              activeTab === 'allowlist'
                ? 'bg-[#1f4d3a] text-[#faf6ef] shadow-sm'
                : 'text-[#7d877f] hover:text-[#1c2621]'
            }`}
          >
            Allowlist ({config.allowlist.length})
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
              activeTab === 'policy'
                ? 'bg-[#1f4d3a] text-[#faf6ef] shadow-sm'
                : 'text-[#7d877f] hover:text-[#1c2621]'
            }`}
          >
            Policy Engine
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
              activeTab === 'agent'
                ? 'bg-[#1f4d3a] text-[#faf6ef] shadow-sm'
                : 'text-[#7d877f] hover:text-[#1c2621]'
            }`}
          >
            Agent Session Key
          </button>
        </div>
      </div>

      {/* Tab 1: Allowlist Registry */}
      {activeTab === 'allowlist' && (
        <div className="space-y-4">
          <p className="text-xs text-[#4a564f] leading-relaxed pretty-text">
            Recipients registered in the allowlist can receive autonomous micro-payments within per-tx and rolling 23h limits. Any non-allowlisted transfer is quarantined for owner sign-off.
          </p>
          <div className="space-y-2.5">
            {config.allowlist.map((addr, idx) => (
              <div
                key={addr}
                className="flex items-center justify-between bg-[#faf6ef] px-4 py-3 rounded-xl border border-[#e6dccb] font-mono text-xs text-[#1c2621]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#7d877f] font-bold">#{idx + 1}</span>
                  <span className="text-[#1c2621] font-medium">{addr}</span>
                  <button
                    onClick={() => handleCopy(addr)}
                    className="text-[#7d877f] hover:text-[#1c2621] transition-colors cursor-pointer"
                    title="Copy address"
                  >
                    {copiedAddr === addr ? (
                      <Check className="w-3.5 h-3.5 text-[#1f4d3a]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1f4d3a] hover:text-[#163828] flex items-center gap-1 font-sans font-semibold text-[11px]"
                >
                  <span>Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Policy Engine */}
      {activeTab === 'policy' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-[#faf6ef] p-4 rounded-xl border border-[#e6dccb] space-y-1.5">
            <span className="text-[#7d877f] font-sans uppercase tracking-wider text-[11px]">Per-Transaction Cap</span>
            <div className="text-xl font-bold text-[#1c2621] font-heading">
              {Number(config.policy.per_tx_cap) / 1e7} <span className="text-[#1f4d3a] text-sm">TUSDC</span>
            </div>
            <p className="text-[#4a564f] font-sans text-[11px] leading-relaxed">
              Single transaction ceiling for autonomous execution. Any proposal &gt; 5.0 halts for human sign-off (Invariant I2).
            </p>
          </div>

          <div className="bg-[#faf6ef] p-4 rounded-xl border border-[#e6dccb] space-y-1.5">
            <span className="text-[#7d877f] font-sans uppercase tracking-wider text-[11px]">Rolling 23-Hour Window Cap</span>
            <div className="text-xl font-bold text-[#1c2621] font-heading">
              {Number(config.policy.daily_cap) / 1e7} <span className="text-[#1f4d3a] text-sm">TUSDC</span>
            </div>
            <p className="text-[#4a564f] font-sans text-[11px] leading-relaxed">
              Cumulative ceiling enforced across 24 sliding hourly buckets on-chain (Invariant I3).
            </p>
          </div>

          <div className="bg-[#faf6ef] p-4 rounded-xl border border-[#e6dccb] space-y-1.5">
            <span className="text-[#7d877f] font-sans uppercase tracking-wider text-[11px]">Proposal Queue TTL</span>
            <div className="text-xl font-bold text-[#1c2621] font-heading">
              {Number(config.policy.proposal_ttl_secs)} <span className="text-[#7d877f] text-sm">seconds (1 Hour)</span>
            </div>
            <p className="text-[#4a564f] font-sans text-[11px] leading-relaxed">
              Unapproved pending proposals expire automatically after 3600 seconds, preventing stale execution.
            </p>
          </div>

          <div className="bg-[#faf6ef] p-4 rounded-xl border border-[#e6dccb] space-y-1.5">
            <span className="text-[#7d877f] font-sans uppercase tracking-wider text-[11px]">Max Pending Queue Capacity</span>
            <div className="text-xl font-bold text-[#1c2621] font-heading">
              25 <span className="text-[#7d877f] text-sm">Proposals</span>
            </div>
            <p className="text-[#4a564f] font-sans text-[11px] leading-relaxed">
              Hard storage DoS boundary (returns on-chain Error #6 QueueFull if adversary attempts flood).
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Agent Session Key */}
      {activeTab === 'agent' && (
        <div className="bg-[#faf6ef] p-5 rounded-xl border border-[#e6dccb] space-y-3 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 gap-1">
            <span className="text-[#7d877f] font-sans">Authorized Agent Key:</span>
            <span className="text-[#1f4d3a] font-bold">{config.agent}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 gap-1 border-t border-[#e6dccb]/70 pt-2">
            <span className="text-[#7d877f] font-sans">Privilege Boundary:</span>
            <span className="text-[#163828] font-semibold bg-[#dfeae3] px-2 py-0.5 rounded border border-[#1f4d3a]/25">
              Proposer Only (Holds Zero Vault Funds)
            </span>
          </div>
          <p className="text-[#4a564f] font-sans text-xs pt-2 border-t border-[#e6dccb]/70 leading-relaxed pretty-text">
            The agent key holds only fee XLM for Soroban transaction submission. It has zero capability to withdraw funds or alter security invariants. Compromising the agent key yields 0.0 TUSDC to an attacker.
          </p>
        </div>
      )}
    </div>
  );
}
