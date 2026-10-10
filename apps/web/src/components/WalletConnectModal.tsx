'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
  X,
  Key,
  Shield,
  Layers,
} from 'lucide-react';
import {
  connectFreighter,
  isFreighterInstalled,
  shortAddress,
} from '../lib/stellar';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: (address: string) => void;
  vaultOwnerAddress?: string;
}

export function WalletConnectModal({
  isOpen,
  onClose,
  onConnectSuccess,
  vaultOwnerAddress = 'GCHBPLNJX6BMD6DA2DH5ZGIINHDNAWTWXKMGABT2DAGXCVGROUMPJTB2',
}: WalletConnectModalProps) {
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Check extension presence when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }

    let isMounted = true;
    isFreighterInstalled().then((installed) => {
      if (isMounted) setHasFreighter(installed);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectFreighter = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await connectFreighter();
      onConnectSuccess(res.address);
      onClose();
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect Freighter wallet.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDevOwnerConnect = () => {
    onConnectSuccess(vaultOwnerAddress);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = customAddress.trim();
    if (!addr.startsWith('G') || addr.length !== 56) {
      setError('Invalid Stellar G-address (must start with G and be 56 characters).');
      return;
    }
    onConnectSuccess(addr);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 relative text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Connect Stellar Wallet</h2>
              <p className="text-xs text-slate-400">Stellar Soroban Testnet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        {/* Extension Detection Status */}
        {hasFreighter === false && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Freighter Extension Not Detected</span>
            </div>
            <p className="text-slate-300">
              Freighter is the official non-custodial browser wallet for Stellar and Soroban dApps.
            </p>
            <a
              href="https://www.freighter.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Install Freighter (freighter.app)</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
            <p className="text-[11px] text-slate-400 italic text-center">
              After installing, reload the page to detect the extension.
            </p>
          </div>
        )}

        {/* Primary Action: Connect Freighter */}
        <div className="space-y-3">
          <button
            onClick={handleConnectFreighter}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-sky-950/40 disabled:opacity-50"
          >
            {connecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Waiting for Freighter Authorization...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span>Connect with Freighter</span>
              </>
            )}
          </button>

          {/* Testnet Requirement Hint */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Required Network:</span>
              <span className="text-emerald-400 font-semibold">Stellar Testnet</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Vault Owner:</span>
              <span className="text-slate-300">{shortAddress(vaultOwnerAddress)}</span>
            </div>
          </div>
        </div>

        {/* Dev / Local Mode Fallbacks */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Developer / Local Testing Mode:</span>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-sky-400 hover:text-sky-300 underline"
            >
              {showManualInput ? 'Hide Manual' : 'Manual Address'}
            </button>
          </div>

          <button
            onClick={handleDevOwnerConnect}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Connect as av-owner ({shortAddress(vaultOwnerAddress)})</span>
            </div>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              Testnet Owner
            </span>
          </button>

          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="space-y-2 pt-1">
              <input
                type="text"
                placeholder="G..."
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl text-slate-200 transition-colors"
              >
                Set Active Address
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
