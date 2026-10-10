'use client';

import React from 'react';
import { History, ExternalLink, Bot, UserCheck, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { shortAddress, VAULT_CONTRACT_ID } from '../lib/stellar';
import type { Proposal, ProposalStatus } from '../lib/types';

interface ProposalFeedProps {
  proposals: Proposal[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProposalFeed({ proposals, isLoading, onRefresh }: ProposalFeedProps) {
  const getStatusBadge = (status: ProposalStatus) => {
    switch (status) {
      case 'Executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Executed
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <History className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-white">Live On-Chain Proposal Feed</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No proposals found in vault storage.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="pb-3 font-semibold">ID</th>
                <th className="pb-3 font-semibold">Channel</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Recipient</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
                <th className="pb-3 font-semibold">Memo</th>
                <th className="pb-3 font-semibold text-right">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {proposals.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-bold text-white">#{p.id}</td>
                  <td className="py-3">
                    {p.auto ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Bot className="w-3 h-3" />
                        AUTO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <UserCheck className="w-3 h-3" />
                        HUMAN
                      </span>
                    )}
                  </td>
                  <td className="py-3">{getStatusBadge(p.status)}</td>
                  <td className="py-3 text-slate-300">{shortAddress(p.to)}</td>
                  <td className="py-3 text-right font-bold text-white">
                    {p.amountFormatted} TUSDC
                  </td>
                  <td className="py-3 text-slate-400 max-w-[150px] truncate" title={p.memo}>
                    &ldquo;{p.memo || '—'}&rdquo;
                  </td>
                  <td className="py-3 text-right">
                    <a
                      href={`https://stellar.expert/explorer/testnet/contract/${VAULT_CONTRACT_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
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
