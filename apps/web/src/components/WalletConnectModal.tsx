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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#fffdf9] border border-[#e6dccb] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 relative text-[#1c2621]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dccb] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#dfeae3] border border-[#1f4d3a]/25 rounded-xl text-[#1f4d3a]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c2621]">Connect Stellar Wallet</h2>
              <p className="text-xs text-[#7d877f]">Stellar Soroban Testnet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#7d877f] hover:text-[#1c2621] p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-[#f8e4db] border border-[#c2512f]/30 rounded-xl p-3.5 text-xs text-[#9d3f22] space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#c2512f] mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        {/* Extension Detection Status */}
        {hasFreighter === false && (
          <div className="bg-[#fef3c7] border border-[#b45309]/30 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-2 text-[#92400e] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Freighter Extension Not Detected</span>
            </div>
            <p className="text-[#4a564f]">
              Freighter is the official non-custodial browser wallet for Stellar and Soroban dApps.
            </p>
            <a
              href="https://www.freighter.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] rounded-xl font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Install Freighter (freighter.app)</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
            <p className="text-[11px] text-[#7d877f] italic text-center">
              After installing, reload the page to detect the extension.
            </p>
          </div>
        )}

        {/* Primary Action: Connect Freighter */}
        <div className="space-y-3">
          <button
            onClick={handleConnectFreighter}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1f4d3a] hover:bg-[#163828] text-[#faf6ef] rounded-xl font-semibold text-sm transition-all shadow-md shadow-[#1f4d3a]/20 disabled:opacity-50 cursor-pointer"
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
          <div className="bg-[#faf6ef] border border-[#e6dccb] rounded-xl p-3 text-xs text-[#4a564f] space-y-1 font-mono">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#7d877f]">Required Network:</span>
              <span className="text-[#163828] font-semibold">Stellar Testnet</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#7d877f]">Vault Owner:</span>
              <span className="text-[#1c2621]">{shortAddress(vaultOwnerAddress)}</span>
            </div>
          </div>
        </div>

        {/* Dev / Local Mode Fallbacks */}
        <div className="pt-2 border-t border-[#e6dccb] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#7d877f]">
            <span>Developer / Local Testing Mode:</span>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-[#1f4d3a] hover:text-[#163828] underline cursor-pointer"
            >
              {showManualInput ? 'Hide Manual' : 'Manual Address'}
            </button>
          </div>

          <button
            onClick={handleDevOwnerConnect}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#faf6ef] hover:bg-[#fffdf9] border border-[#e6dccb] rounded-xl text-xs font-mono text-[#1c2621] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#b45309]" />
              <span>Connect as av-owner ({shortAddress(vaultOwnerAddress)})</span>
            </div>
            <span className="text-[10px] text-[#92400e] bg-[#fef3c7] px-2 py-0.5 rounded font-sans font-semibold">
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
                className="w-full bg-[#fffdf9] border border-[#e6dccb] rounded-xl px-3 py-2 text-xs font-mono text-[#1c2621] placeholder-[#7d877f] focus:outline-none focus:border-[#1f4d3a]"
              />
              <button
                type="submit"
                className="w-full py-2 bg-[#1f4d3a] hover:bg-[#163828] text-xs font-medium rounded-xl text-[#faf6ef] transition-colors cursor-pointer"
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
