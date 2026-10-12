'use client';

import React, { useState } from 'react';
import { History, ExternalLink, Bot, UserCheck, CheckCircle2, Clock, XCircle, AlertTriangle, Filter } from 'lucide-react';
import { shortAddress, VAULT_CONTRACT_ID } from '../lib/stellar';
import type { Proposal, ProposalStatus } from '../lib/types';

interface ProposalFeedProps {
  proposals: Proposal[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProposalFeed({ proposals, isLoading, onRefresh }: ProposalFeedProps) {
  const [filter, setFilter] = useState<'ALL' | 'Executed' | 'Pending' | 'Rejected'>('ALL');

  const filtered = filter === 'ALL' ? proposals : proposals.filter((p) => p.status === filter);

  const getStatusBadge = (status: ProposalStatus) => {
    switch (status) {
      case 'Executed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Executed
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-7 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e6dccb]/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#dfeae3] border border-[#1f4d3a]/25 rounded-xl text-[#1f4d3a]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1c2621] font-heading">On-Chain Proposal Audit Feed</h2>
            <p className="text-xs text-[#7d877f]">Verifiable chronological audit log directly from Soroban contract instance storage</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Chips */}
          <div className="inline-flex p-0.5 bg-[#faf6ef] rounded-xl border border-[#e6dccb] text-xs">
            {(['ALL', 'Executed', 'Pending', 'Rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  filter === s
                    ? 'bg-[#1f4d3a] text-[#faf6ef] font-bold shadow-sm'
                    : 'text-[#7d877f] hover:text-[#1c2621]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs px-3 py-1 text-[#4a564f] hover:text-[#1c2621] bg-[#fffdf9] border border-[#e6dccb] rounded-xl disabled:opacity-50 cursor-pointer transition-all hover:bg-[#faf6ef]"
          >
            {isLoading ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-[#7d877f] text-sm">
          No proposals match the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#e6dccb] text-[#7d877f]">
                <th className="pb-3 font-semibold font-sans">ID</th>
                <th className="pb-3 font-semibold font-sans">Execution Mode</th>
                <th className="pb-3 font-semibold font-sans">Status</th>
                <th className="pb-3 font-semibold font-sans">Recipient</th>
                <th className="pb-3 font-semibold text-right font-sans">Amount</th>
                <th className="pb-3 font-semibold font-sans">Memo</th>
                <th className="pb-3 font-semibold text-right font-sans">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6dccb]/60">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#faf6ef]/70 transition-colors">
                  <td className="py-3 font-bold text-[#1c2621]">#{p.id}</td>
                  <td className="py-3">
                    {p.auto ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/20">
                        <Bot className="w-3 h-3" />
                        AUTO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f8e4db] text-[#9d3f22] border border-[#c2512f]/20">
                        <UserCheck className="w-3 h-3" />
                        HUMAN
                      </span>
                    )}
                  </td>
                  <td className="py-3">{getStatusBadge(p.status)}</td>
                  <td className="py-3 text-[#1c2621] font-sans">{shortAddress(p.to)}</td>
                  <td className="py-3 text-right font-bold text-[#1c2621]">
                    {p.amountFormatted} <span className="text-[#7d877f] text-[10px]">TUSDC</span>
                  </td>
                  <td className="py-3 text-[#4a564f] max-w-[160px] truncate" title={p.memo}>
                    &ldquo;{p.memo || '—'}&rdquo;
                  </td>
                  <td className="py-3 text-right">
                    <a
                      href={`https://stellar.expert/explorer/testnet/contract/${VAULT_CONTRACT_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1f4d3a] hover:text-[#163828] inline-flex items-center gap-1 font-sans font-semibold text-[11px]"
                    >
                      <span>Events</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
