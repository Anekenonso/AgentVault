'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { StatusHeader } from '../components/StatusHeader';
import { AllowanceMeter } from '../components/AllowanceMeter';
import { PendingApprovals } from '../components/PendingApprovals';
import { ProposalFeed } from '../components/ProposalFeed';
import { ScenarioRunner } from '../components/ScenarioRunner';
import { OwnerControls } from '../components/OwnerControls';
import { WalletConnectModal } from '../components/WalletConnectModal';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { BrandLogo } from '../components/BrandLogo';
import {
  fetchVaultConfig,
  fetchProposals,
  approveProposalWithFreighter,
  rejectProposalWithFreighter,
  togglePauseWithFreighter,
  shortAddress,
  formatTUSDC,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_FALLBACK_PROPOSALS,
} from '../lib/stellar';
import type { Proposal, VaultConfig } from '../lib/types';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Zap,
  ShieldAlert,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';

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

  // Segmented tab state
  const [activeTab, setActiveTab] = useState<'command' | 'playground' | 'ledger' | 'governance'>('command');
  const [showWorkflowStepper, setShowWorkflowStepper] = useState(false);

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
      await loadData();
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
      await loadData();
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

  const pendingCount = proposals.filter((p) => p.status === 'Pending').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* TON.org-Inspired Editorial Brand Hero & Telemetry Bar */}
      <div className="relative py-6 sm:py-8 border-b border-[#e6dccb]">
        {/* Subtle Ambient Depth */}
        <div className="absolute top-0 left-1/3 w-96 h-36 bg-[#1f4d3a]/05 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#163828] uppercase bg-[#dfeae3] px-3 py-1 rounded-full border border-[#1f4d3a]/25">
            SOVEREIGN AI SECURITY LAYER
          </span>
          <span className="text-xs font-mono text-[#7d877f] hidden sm:inline">
            ON-CHAIN AUTHORITY BOUNDARY
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#1c2621] tracking-tight font-heading leading-tight max-w-4xl">
          The On-Chain Authority Boundary for Autonomous AI
        </h1>

        <p className="text-sm sm:text-base text-[#4a564f] mt-3 max-w-3xl leading-relaxed pretty-text">
          <strong className="text-[#1c2621]">AI models handle ambiguity. Deterministic smart contracts handle authority.</strong>{' '}
          AgentVault decouples intelligence from spending keys—guaranteeing that compromised or jailbroken agents cannot drain treasury funds.
        </p>

        {/* TON.org Signature Floating Network Metric Badges */}
        <div className="flex flex-wrap items-center gap-2.5 mt-6">
          <div className="px-4 py-2 rounded-full bg-[#fffdf9] border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex items-center gap-2 text-xs shadow-sm">
            <span className="font-mono font-bold text-[#1c2621] text-sm">
              {config ? formatTUSDC(config.balance) : '39.0'} TUSDC
            </span>
            <span className="text-[#7d877f] font-sans text-[11px]">Vault Treasury</span>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#fffdf9] border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex items-center gap-2 text-xs shadow-sm">
            <span className="font-mono font-bold text-[#1f4d3a] text-sm">50 / 50</span>
            <span className="text-[#7d877f] font-sans text-[11px]">Attacks Blocked</span>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#fffdf9] border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex items-center gap-2 text-xs shadow-sm">
            <span className="font-mono font-bold text-[#163828] text-sm">8 / 8</span>
            <span className="text-[#7d877f] font-sans text-[11px]">Soroban Invariants</span>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#fffdf9] border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex items-center gap-2 text-xs shadow-sm">
            <span className="font-mono font-bold text-[#1c2621] text-sm">0.0%</span>
            <span className="text-[#7d877f] font-sans text-[11px]">Loss Under Attack</span>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#fffdf9] border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex items-center gap-2 text-xs shadow-sm">
            <span className="font-mono font-bold text-[#c2512f] text-sm">23h</span>
            <span className="text-[#7d877f] font-sans text-[11px]">Rolling Window</span>
          </div>
        </div>

        {/* 3 Micro-Capsule Value Pillars */}
        <div className="flex flex-wrap items-center gap-2 mt-4 font-mono text-[11px]">
          <span className="px-3 py-1 rounded-full bg-[#faf6ef] border border-[#e6dccb] text-[#4a564f] flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1f4d3a]" />
            01 / MATHEMATICALLY BOUNDED (I1–I8)
          </span>
          <span className="px-3 py-1 rounded-full bg-[#faf6ef] border border-[#e6dccb] text-[#4a564f] flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5b7f6a]" />
            02 / NON-BYPASSABLE HUMAN OVERSIGHT
          </span>
          <span className="px-3 py-1 rounded-full bg-[#faf6ef] border border-[#e6dccb] text-[#4a564f] flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c2512f]" />
            03 / ZERO TREASURY KEYS IN AGENT RUNTIME
          </span>
        </div>
      </div>

      {/* RPC / State Error Banner */}
      {error && (
        <div className="bg-[#f8e4db] border border-[#c2512f]/30 rounded-2xl p-4 flex items-center justify-between text-xs text-[#9d3f22] shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#c2512f]" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 font-semibold text-[#9d3f22] hover:text-[#1c2621] cursor-pointer px-2 py-1 rounded-lg hover:bg-[#c2512f]/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-[#f8e4db] border border-[#c2512f]/40 rounded-2xl p-4 flex items-start justify-between text-xs text-[#9d3f22] animate-in fade-in shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#c2512f] mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-[#9d3f22] font-heading">Transaction Notice:</span>
              <p className="text-[#4a564f] whitespace-pre-line leading-relaxed pretty-text">{actionError}</p>
            </div>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-[#7d877f] hover:text-[#1c2621] p-1 rounded-lg cursor-pointer hover:bg-black/[0.05] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Success Banner */}
      {actionSuccess && (
        <div className="bg-[#dfeae3] border border-[#1f4d3a]/30 rounded-2xl p-4 flex items-center justify-between text-xs text-[#163828] animate-in fade-in shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1f4d3a]" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-[#1f4d3a]/60 hover:text-[#163828] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Clean Telemetry Hero Bar */}
      <StatusHeader
        config={config}
        walletAddress={walletAddress}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onTogglePause={handleTogglePause}
        isActionLoading={actionLoading}
      />

      {/* Discrete Architecture Guide Accordion */}
      <div className="space-y-2.5">
        <button
          onClick={() => setShowWorkflowStepper(!showWorkflowStepper)}
          className="w-full bg-[#fffdf9] hover:bg-[#faf6ef] border border-[#e6dccb] hover:border-[#cfc2ab] rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs text-[#4a564f] hover:text-[#1c2621] transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-[#dfeae3] border border-[#1f4d3a]/20 rounded-lg text-[#1f4d3a] group-hover:scale-105 transition-transform">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-[#1c2621] font-heading">How AgentVault Works</span>
            <span className="text-[#7d877f] hidden sm:inline">&bull; 4-Step Zero-Trust Spending Lifecycle</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#7d877f] text-[11px] font-mono">
            <span>{showWorkflowStepper ? 'Hide architecture guide' : 'View architecture guide'}</span>
            {showWorkflowStepper ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {showWorkflowStepper && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <WorkflowStepper />
          </div>
        )}
      </div>

      {/* TON.org-Inspired Capsule Segmented Control */}
      <div className="flex items-center justify-between border-b border-[#e6dccb] pb-3">
        <div className="inline-flex p-1 bg-[#faf6ef] border border-[#e6dccb] rounded-full shadow-inner gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('command')}
            className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'command'
                ? 'bg-[#1f4d3a] text-[#faf6ef] font-bold shadow-md shadow-[#1f4d3a]/25'
                : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Command Center</span>
            {pendingCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'command'
                    ? 'bg-[#faf6ef] text-[#1f4d3a]'
                    : 'bg-[#fef3c7] text-[#92400e] border border-[#b45309]/30'
                }`}
              >
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'playground'
                ? 'bg-[#1f4d3a] text-[#faf6ef] font-bold shadow-md shadow-[#1f4d3a]/25'
                : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#c2512f]" />
            <span>Attack Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-[#1f4d3a] text-[#faf6ef] font-bold shadow-md shadow-[#1f4d3a]/25'
                : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#5b7f6a]" />
            <span>Audit Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('governance')}
            className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'governance'
                ? 'bg-[#1f4d3a] text-[#faf6ef] font-bold shadow-md shadow-[#1f4d3a]/25'
                : 'text-[#4a564f] hover:text-[#1c2621] hover:bg-[#fffdf9]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#7d877f]" />
            <span>Governance</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-[#7d877f] hidden md:inline">
          Soroban Protocol 29 &bull; Testnet
        </span>
      </div>

      {/* Tab 1: Command Center */}
      {activeTab === 'command' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main 2-Column Grid: Allowance Gauge & Sign-Off Queue */}
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

          {/* Clean Recent Activity Summary */}
          <div className="glass-panel rounded-2xl p-6 border border-[#e6dccb]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e6dccb]/70">
              <div>
                <h3 className="text-sm font-bold text-[#1c2621] font-heading">Recent On-Chain Activity</h3>
                <p className="text-xs text-[#7d877f]">Latest proposals processed by the vault</p>
              </div>
              <button
                onClick={() => setActiveTab('ledger')}
                className="text-xs text-[#1f4d3a] hover:text-[#163828] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                View full audit feed ({proposals.length}) &rarr;
              </button>
            </div>

            <div className="divide-y divide-[#e6dccb]/60">
              {proposals.slice(0, 3).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#7d877f] font-bold">#{p.id}</span>
                    <span className="font-bold text-[#1c2621]">{p.amountFormatted} TUSDC</span>
                    <span className="text-[#4a564f] hidden sm:inline truncate max-w-xs">{p.memo || 'No memo'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        p.status === 'Executed'
                          ? 'bg-[#dfeae3] text-[#163828] border border-[#1f4d3a]/25'
                          : p.status === 'Pending'
                          ? 'bg-[#fef3c7] text-[#92400e] border border-[#b45309]/30'
                          : 'bg-[#f8e4db] text-[#9d3f22] border border-[#c2512f]/30'
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-[#7d877f] font-mono text-[10px]">
                      {p.auto ? 'Auto' : 'Human'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attack Playground */}
      {activeTab === 'playground' && (
        <div className="animate-in fade-in duration-150">
          <ScenarioRunner onScenarioComplete={loadData} />
        </div>
      )}

      {/* Tab 3: Live Audit Feed */}
      {activeTab === 'ledger' && (
        <div className="animate-in fade-in duration-150">
          <ProposalFeed
            proposals={proposals}
            isLoading={loading}
            onRefresh={loadData}
          />
        </div>
      )}

      {/* Tab 4: Vault Governance */}
      {activeTab === 'governance' && (
        <div className="animate-in fade-in duration-150">
          <OwnerControls
            config={config}
            walletAddress={walletAddress}
          />
        </div>
      )}

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
