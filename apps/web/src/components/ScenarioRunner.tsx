'use client';

import React, { useState } from 'react';
import { Terminal, Play, ShieldAlert, CheckCircle2, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { VAULT_CONTRACT_ID } from '../lib/stellar';

interface ScenarioResult {
  scenario: string;
  status: 'EXECUTED' | 'QUEUED_PENDING' | 'SCHEMA_REJECTED' | 'CONTRACT_ERROR';
  message: string;
  tx_hash?: string;
  proposal_id?: number;
  explorer_url?: string;
}

export function ScenarioRunner({ onScenarioComplete }: { onScenarioComplete?: () => void }) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const scenarios = [
    {
      id: 'legit_purchase',
      title: 'Legit Micro-Payment',
      desc: '1.0 TUSDC to allowlisted Merchant API under caps',
      badge: 'Auto-Executed',
      badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
    {
      id: 'over_per_tx_cap',
      title: 'Exceeds Per-Tx Cap',
      desc: '15.0 TUSDC to merchant (exceeds 5.0 cap)',
      badge: 'Queued Pending',
      badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    },
    {
      id: 'unknown_payee',
      title: 'Unknown / Attacker Payee',
      desc: 'Attempt to transfer to non-allowlisted address',
      badge: 'Containment Queue',
      badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    },
    {
      id: 'prompt_injection',
      title: 'Prompt-Injection Attack',
      desc: 'Adversarial quote text overriding tool instructions',
      badge: 'Zod / Vault Defense',
      badgeColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    },
    {
      id: 'drain_replay',
      title: 'Treasury Drain Attempt',
      desc: 'Adversary requesting full contract balance',
      badge: 'Blocked by Policy',
      badgeColor: 'text-red-400 border-red-500/30 bg-red-500/10',
    },
  ];

  const handleRun = async (scenarioId: string) => {
    setRunning(scenarioId);
    setResult(null);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId }),
      });

      const data = await res.json();
      setResult(data);
      if (onScenarioComplete) onScenarioComplete();
    } catch (err: any) {
      setResult({
        scenario: scenarioId,
        status: 'CONTRACT_ERROR',
        message: err.message || 'Network error triggering scenario',
      });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div id="playground" className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
          <Terminal className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Live Attack & Scenario Playground</h2>
          <p className="text-xs text-slate-400">
            Trigger real LLM agent payment proposals against the live Testnet Vault contract
          </p>
        </div>
      </div>

      {/* Grid of Scenario Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-white">{s.title}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${s.badgeColor}`}>
                  {s.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{s.desc}</p>
            </div>

            <button
              onClick={() => handleRun(s.id)}
              disabled={Boolean(running)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {running === s.id ? 'Running on Testnet...' : 'Execute Scenario'}
            </button>
          </div>
        ))}
      </div>

      {/* Live Output Console */}
      {result && (
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>Scenario:</span>
              <strong className="text-white">{result.scenario}</strong>
            </span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                result.status === 'EXECUTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : result.status === 'QUEUED_PENDING'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {result.status}
            </span>
          </div>

          <p className="text-slate-300">{result.message}</p>

          {result.tx_hash && (
            <div className="flex items-center justify-between pt-2 text-slate-400">
              <span>Tx Hash: {result.tx_hash.slice(0, 16)}...</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                View on Stellar Expert <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
