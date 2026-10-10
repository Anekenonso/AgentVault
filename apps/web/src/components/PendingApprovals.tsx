'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, ShieldAlert, ArrowRight, RefreshCw, Zap, Plus, Sparkles, Clock } from 'lucide-react';
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

  // Only display ACTIVE, non-expired pending proposals in the Human Sign-Off queue!
  // Expired proposals cannot be approved by the contract policy (Error #9).
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
    <div id="pending-queue" className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white">Pending Human Sign-Off Queue</h2>
          </div>
          <div className="flex items-center gap-2">
            {onGenerateLiveTx && (
              <button
                type="button"
                onClick={onGenerateLiveTx}
                disabled={isActionLoading}
                title="Trigger agent to propose a new live transaction over the per-tx cap"
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Live Tx</span>
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh queue from Stellar Soroban testnet"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
              pendingList.length > 0
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {pendingList.length} Pending
            </span>
          </div>
        </div>

        {pendingList.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl space-y-4 my-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Queue is Clear</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                All pre-filled testing items have been cleared. As your autonomous AI Agent proposes transactions outside policy caps, they will appear here live for sign-off.
              </p>
            </div>
            {onGenerateLiveTx && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onGenerateLiveTx}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-950/40 inline-flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  {isActionLoading ? 'Agent Submitting Live Tx on Testnet...' : 'Generate Live Over-Cap Agent Tx'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 my-2">
            {pendingList.map((p) => (
              <div
                key={p.id}
                className="bg-slate-950/80 rounded-xl p-4 transition-all border border-amber-500/30 hover:border-amber-500/50 shadow-sm shadow-amber-950/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400 font-bold">
                        #{p.id}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {p.amountFormatted} TUSDC
                      </span>
                      <span className="text-xs text-slate-500">to</span>
                      <span className="text-xs font-mono text-slate-300">
                        {shortAddress(p.to)}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        LIVE &bull; 1h Window
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>Memo: &ldquo;{p.memo || 'None'}&rdquo;</span>
                      {p.reason_hash && (
                        <span className="text-slate-600 font-mono">
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
                      title={
                        walletAddress
                          ? 'Approve proposal on-chain with Freighter'
                          : 'Connect Owner wallet to approve'
                      }
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirmation(p, 'reject')}
                      disabled={isActionLoading}
                      title={walletAddress ? 'Reject proposal on-chain with Freighter' : 'Connect Owner wallet to reject'}
                      className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
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

      {!walletAddress ? (
        <div className="text-center pt-3 border-t border-slate-800/80 mt-2">
          <button
            type="button"
            onClick={onRequireWallet}
            className="text-[11px] text-amber-400/90 hover:text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Connect Vault Owner wallet to sign and submit live approvals on-chain &rarr;</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 mt-2">
          <span>Connected: <span className="font-mono text-slate-400">{shortAddress(walletAddress)}</span></span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Ready for Freighter Signatures
          </span>
        </div>
      )}

      {/* Decoded Transaction Summary Modal */}
      {selectedProposal && modalAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  modalAction === 'approve'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white capitalize">
                  Confirm {modalAction} Proposal #{selectedProposal.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Inspect the decoded payload before signing with Freighter
                </p>
              </div>
            </div>

            {/* Decoded Summary Box */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-500">Proposal ID:</span>
                <span className="text-white font-bold">#{selectedProposal.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-500">Recipient:</span>
                <span className="text-sky-300">{selectedProposal.to}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-500">Amount:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {selectedProposal.amountFormatted} TUSDC
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-500">Memo (Plain Text):</span>
                <span className="text-slate-300">&ldquo;{selectedProposal.memo}&rdquo;</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Target Network:</span>
                <span className="text-emerald-400 font-bold">Stellar Testnet</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer ${
                  modalAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50'
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
