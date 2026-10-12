'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Zap,
  Plus,
  Sparkles,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { shortAddress, formatTUSDC } from '../lib/stellar';
import type { Proposal } from '../lib/types';

interface PendingApprovalsProps {
  proposals: Proposal[];
  walletAddress: string | null;
  onApprove: (proposalId: number) => Promise<void>;
  onReject: (proposalId: number) => Promise<void>;
  isActionLoading: boolean;
  onRequireWallet?: () => void;
  onRefresh?: () => void;
  onGenerateLiveTx?: () => Promise<void>;
}

export function PendingApprovals({
  proposals,
  walletAddress,
  onApprove,
  onReject,
  isActionLoading,
  onRequireWallet,
  onRefresh,
  onGenerateLiveTx,
}: PendingApprovalsProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | null>(null);

  const isProposalExpired = (p: Proposal) => {
    if (!p.created_at) return false;
    const now = Math.floor(Date.now() / 1000);
    return now > p.created_at + 3600;
  };

  const pendingList = proposals.filter((p) => p.status === 'Pending' && !isProposalExpired(p));

  const openConfirmation = (p: Proposal, action: 'approve' | 'reject') => {
    if (!walletAddress && onRequireWallet) {
      onRequireWallet();
      return;
    }
    setSelectedProposal(p);
    setModalAction(action);
  };

  const closeModal = () => {
    setSelectedProposal(null);
    setModalAction(null);
  };

  const handleConfirm = async () => {
    if (!selectedProposal || !modalAction) return;
    const id = selectedProposal.id;
    closeModal();
    if (modalAction === 'approve') {
      await onApprove(id);
    } else {
      await onReject(id);
    }
  };

  return (
    <div id="pending-queue" className="glass-panel rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e6dccb]/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#fef3c7] border border-[#b45309]/20 rounded-xl text-[#b45309]">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c2621] font-heading">Human Sign-Off Queue</h2>
              <p className="text-[11px] text-[#7d877f]">Non-bypassable sovereign approval barrier</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onGenerateLiveTx && (
              <button
                type="button"
                onClick={onGenerateLiveTx}
                disabled={isActionLoading}
                title="Trigger agent to propose a new live transaction over the per-tx cap"
                className="px-2.5 py-1 bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] border border-[#b45309]/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Live Tx</span>
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh queue from Stellar Soroban testnet"
                className="p-1.5 text-[#7d877f] hover:text-[#1c2621] hover:bg-[#faf6ef] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                pendingList.length > 0
                  ? 'bg-[#fef3c7] text-[#92400e] border-[#b45309]/40 animate-pulse'
                  : 'bg-[#faf6ef] text-[#7d877f] border-[#e6dccb]'
              }`}
            >
              {pendingList.length} Pending
            </span>
          </div>
        </div>

        {/* Content State: Empty vs List */}
        {pendingList.length === 0 ? (
          <div className="py-7 text-center border border-dashed border-[#e6dccb] rounded-xl space-y-3.5 my-2 bg-[#faf6ef]/50">
            <div className="w-12 h-12 rounded-full bg-[#dfeae3] border border-[#1f4d3a]/25 flex items-center justify-center mx-auto text-[#1f4d3a]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#1c2621] font-heading">Queue is Clear &bull; Invariants Holding</p>
              <p className="text-xs text-[#4a564f] max-w-sm mx-auto leading-relaxed pretty-text">
                All autonomous agent payments comply with policy caps. High-value proposals (&gt; 5.0 TUSDC) or unapproved payees will pause here for sovereign sign-off.
              </p>
            </div>
            {onGenerateLiveTx && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onGenerateLiveTx}
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] font-bold rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  {isActionLoading ? 'Agent Proposing on Testnet...' : 'Simulate Over-Cap Live Agent Tx'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 my-2">
            {pendingList.map((p) => (
              <div
                key={p.id}
                className="bg-[#fffdf9] rounded-xl p-4 transition-all border border-[#b45309]/30 hover:border-[#b45309]/60 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#92400e] font-bold bg-[#fef3c7] px-1.5 py-0.2 rounded border border-[#b45309]/30">
                        #{p.id}
                      </span>
                      <span className="text-sm font-bold text-[#1c2621] font-heading">
                        {p.amountFormatted} <span className="text-[#92400e] font-mono text-xs">TUSDC</span>
                      </span>
                      <span className="text-xs text-[#7d877f]">&rarr;</span>
                      <span className="text-xs font-mono text-[#1c2621]">
                        {shortAddress(p.to)}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/30 animate-pulse flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Awaiting Human
                      </span>
                    </div>
                    <div className="text-xs text-[#4a564f] flex items-center gap-2">
                      <span>Memo: &ldquo;{p.memo || 'None'}&rdquo;</span>
                      {p.reason_hash && (
                        <span className="text-[#7d877f] font-mono text-[10px]">
                          Hash: {p.reason_hash.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConfirmation(p, 'approve')}
                      disabled={isActionLoading}
                      title={walletAddress ? 'Approve proposal on-chain with Freighter' : 'Connect Owner wallet to approve'}
                      className="px-3.5 py-2 bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirmation(p, 'reject')}
                      disabled={isActionLoading}
                      title={walletAddress ? 'Reject proposal on-chain with Freighter' : 'Connect Owner wallet to reject'}
                      className="px-3 py-2 bg-[#f8e4db] hover:bg-[#f3d0c2] text-[#9d3f22] border border-[#c2512f]/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Status */}
      {!walletAddress ? (
        <div className="text-center pt-3 border-t border-[#e6dccb]/70 mt-2">
          <button
            type="button"
            onClick={onRequireWallet}
            className="text-[11px] text-[#1f4d3a] hover:text-[#163828] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>Connect Vault Owner wallet to sign live approvals on-chain &rarr;</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-[#7d877f] pt-3 border-t border-[#e6dccb]/70 mt-2 font-mono">
          <span>Signer: <span className="text-[#1c2621] font-bold">{shortAddress(walletAddress)}</span></span>
          <span className="text-[#163828] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1f4d3a] animate-pulse" />
            Freighter Active
          </span>
        </div>
      )}

      {/* Decoded Transaction Summary Modal */}
      {selectedProposal && modalAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#fffdf9] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 border border-[#e6dccb]">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  modalAction === 'approve'
                    ? 'bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/30'
                    : 'bg-[#f8e4db] text-[#9d3f22] border border-[#c2512f]/30'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1c2621] capitalize font-heading">
                  Confirm {modalAction} Proposal #{selectedProposal.id}
                </h3>
                <p className="text-xs text-[#7d877f]">
                  Inspect the decoded payload before signing with Freighter
                </p>
              </div>
            </div>

            {/* Decoded Summary Box */}
            <div className="bg-[#faf6ef] rounded-xl p-4 border border-[#e6dccb] space-y-2.5 text-xs font-mono shadow-inner">
              <div className="flex justify-between py-1 border-b border-[#e6dccb]/60">
                <span className="text-[#7d877f] font-sans">Proposal ID:</span>
                <span className="text-[#1c2621] font-bold">#{selectedProposal.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e6dccb]/60">
                <span className="text-[#7d877f] font-sans">Recipient:</span>
                <span className="text-[#1f4d3a] font-bold">{shortAddress(selectedProposal.to)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e6dccb]/60">
                <span className="text-[#7d877f] font-sans">Amount:</span>
                <span className="text-[#163828] font-bold text-sm">
                  {selectedProposal.amountFormatted} TUSDC
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e6dccb]/60">
                <span className="text-[#7d877f] font-sans">Memo:</span>
                <span className="text-[#4a564f] truncate max-w-[200px]">&ldquo;{selectedProposal.memo}&rdquo;</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#7d877f] font-sans">Target Network:</span>
                <span className="text-[#163828] font-bold">Stellar Testnet (Soroban)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs text-[#7d877f] hover:text-[#1c2621] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-[#faf6ef] transition-all cursor-pointer ${
                  modalAction === 'approve'
                    ? 'bg-[#1f4d3a] hover:bg-[#163828] shadow-md shadow-[#1f4d3a]/25'
                    : 'bg-[#c2512f] hover:bg-[#9d3f22] shadow-md shadow-[#c2512f]/25'
                }`}
              >
                Sign with Freighter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
