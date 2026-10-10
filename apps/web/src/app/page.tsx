'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { StatusHeader } from '../components/StatusHeader';
import { AllowanceMeter } from '../components/AllowanceMeter';
import { PendingApprovals } from '../components/PendingApprovals';
import { ProposalFeed } from '../components/ProposalFeed';
import { ScenarioRunner } from '../components/ScenarioRunner';
import { OwnerControls } from '../components/OwnerControls';
import { WalletConnectModal } from '../components/WalletConnectModal';
import {
  fetchVaultConfig,
  fetchProposals,
  approveProposalWithFreighter,
  rejectProposalWithFreighter,
  togglePauseWithFreighter,
  shortAddress,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_FALLBACK_PROPOSALS,
} from '../lib/stellar';
import type { Proposal, VaultConfig } from '../lib/types';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';

export default function DashboardPage() {
  const [config, setConfig] = useState<VaultConfig>(DEFAULT_FALLBACK_CONFIG);
  const [proposals, setProposals] = useState<Proposal[]>(DEFAULT_FALLBACK_PROPOSALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [cfg, props] = await Promise.all([
        fetchVaultConfig(),
        fetchProposals(25),
      ]);
      if (cfg) setConfig(cfg);
      if (props && props.length > 0) setProposals(props);
      setError(null);
    } catch (err: any) {
      console.warn('Background sync with Soroban RPC delayed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll every 12 seconds for fresh on-chain state
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleConnectWallet = () => {
    setIsWalletModalOpen(true);
  };

  const handleConnectSuccess = (addr: string) => {
    setWalletAddress(addr);
    setActionError(null);
    setActionSuccess(`Connected wallet: ${shortAddress(addr)}`);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setActionSuccess('Wallet disconnected.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleTogglePause = async () => {
    if (!walletAddress || !config) {
      setIsWalletModalOpen(true);
      return;
    }

    if (walletAddress !== config.owner) {
      setActionError(
        `Action Restricted: Only the designated Vault Owner (${shortAddress(config.owner)}) can trigger the emergency kill-switch. Connected account is ${shortAddress(walletAddress)}.`
      );
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await togglePauseWithFreighter(config.paused, walletAddress);
      setActionSuccess(`Vault successfully ${config.paused ? 'unpaused' : 'paused'} on-chain.`);
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setActionError(`Pause action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveProposal = async (proposalId: number) => {
    if (!walletAddress || !config) {
      setIsWalletModalOpen(true);
      return;
    }

    if (walletAddress !== config.owner) {
      setActionError(
        `Action Restricted: Only the designated Vault Owner (${shortAddress(config.owner)}) can approve proposals. Connected account is ${shortAddress(walletAddress)}.`
      );
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await approveProposalWithFreighter(proposalId, walletAddress);
      setActionSuccess(`Proposal #${proposalId} approved and executed on-chain.`);
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setActionError(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProposal = async (proposalId: number) => {
    if (!walletAddress || !config) {
      setIsWalletModalOpen(true);
      return;
    }

    if (walletAddress !== config.owner) {
      setActionError(
        `Action Restricted: Only the designated Vault Owner (${shortAddress(config.owner)}) can reject proposals. Connected account is ${shortAddress(walletAddress)}.`
      );
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await rejectProposalWithFreighter(proposalId, walletAddress);
      setActionSuccess(`Proposal #${proposalId} rejected on-chain.`);
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setActionError(`Rejection failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateLiveTx = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'over_per_tx_cap' }),
      });
      const data = await res.json();
      if (data.status === 'QUEUED_PENDING') {
        setActionSuccess(
          `Live Agent Transaction generated on Testnet! Fresh proposal enqueued for human sign-off.`
        );
      } else if (data.status === 'EXECUTED') {
        setActionSuccess(`Transaction auto-executed on Testnet: ${data.message}`);
      } else {
        setActionSuccess(`Scenario response: ${data.message}`);
      }
      setTimeout(() => setActionSuccess(null), 6000);
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to generate live transaction: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* RPC / State Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1 font-semibold text-rose-200 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 flex items-start justify-between text-xs text-rose-200 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-rose-300">Transaction Notice:</span>
              <p className="text-slate-300 whitespace-pre-line">{actionError}</p>
            </div>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Success Banner */}
      {actionSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400/60 hover:text-emerald-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Header & Prominent Kill-Switch */}
      <StatusHeader
        config={config}
        walletAddress={walletAddress}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onTogglePause={handleTogglePause}
        isActionLoading={actionLoading}
      />

      {/* Grid: Allowance Meter + Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AllowanceMeter config={config} />
        <PendingApprovals
          proposals={proposals}
          walletAddress={walletAddress}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          isActionLoading={actionLoading}
          onRequireWallet={() => setIsWalletModalOpen(true)}
          onRefresh={loadData}
          onGenerateLiveTx={handleGenerateLiveTx}
        />
      </div>

      {/* Interactive Scenario Runner */}
      <ScenarioRunner onScenarioComplete={loadData} />

      {/* Live Proposal Feed */}
      <ProposalFeed
        proposals={proposals}
        isLoading={loading}
        onRefresh={loadData}
      />

      {/* Owner Authority Console */}
      <OwnerControls
        config={config}
        walletAddress={walletAddress}
      />

      {/* Stellar Wallet Connection Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnectSuccess={handleConnectSuccess}
        vaultOwnerAddress={config?.owner}
      />
    </div>
  );
}
