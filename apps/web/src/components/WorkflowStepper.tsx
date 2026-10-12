'use client';

import React from 'react';
import { Bot, ShieldCheck, UserCheck, CheckCircle2, ArrowRight, Zap, Info } from 'lucide-react';

interface WorkflowStepperProps {
  activeStep?: number;
}

export function WorkflowStepper({ activeStep = 0 }: WorkflowStepperProps) {
  const steps = [
    {
      step: 1,
      title: '1. AI Agent Proposes',
      subtitle: 'Zero Treasury Funds',
      desc: 'Agent parses untrusted invoice and calls propose(). Holds only gas fee XLM.',
      icon: Bot,
      accent: 'text-[#1f4d3a] bg-[#dfeae3] border-[#1f4d3a]/25',
    },
    {
      step: 2,
      title: '2. Soroban Policy Engine',
      subtitle: 'Hard On-Chain Constraints',
      desc: 'Verifies recipient allowlist (I1), 5.0 per-tx cap (I2), and 20.0 rolling 23h limit (I3).',
      icon: ShieldCheck,
      accent: 'text-[#163828] bg-[#dfeae3] border-[#1f4d3a]/25',
    },
    {
      step: 3,
      title: '3. Auto-Pay OR Human Queue',
      subtitle: 'Deterministic Branching',
      desc: 'Safe payments auto-execute in ~4s. Out-of-policy requests pause for sovereign human sign-off.',
      icon: UserCheck,
      accent: 'text-[#92400e] bg-[#fef3c7] border-[#b45309]/30',
    },
    {
      step: 4,
      title: '4. Final Settlement & Proof',
      subtitle: 'Tamper-Proof Ledger Emit',
      desc: 'Paid APIs query on-chain executed events before delivering requested payload.',
      icon: CheckCircle2,
      accent: 'text-[#163828] bg-[#dfeae3] border-[#1f4d3a]/25',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#e6dccb] relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#e6dccb]/70">
        <div>
          <span className="text-[11px] font-mono font-bold text-[#1f4d3a] uppercase tracking-wider">
            ARCHITECTURE AT A GLANCE
          </span>
          <h3 className="text-sm sm:text-base font-bold text-[#1c2621] font-heading mt-0.5">
            How AgentVault Protects Funds Without Killing Autonomy
          </h3>
        </div>
        <div className="text-xs text-[#4a564f] font-sans sm:text-right">
          <strong className="text-[#1c2621]">AI handles ambiguity.</strong> Code handles authority.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="bg-[#faf6ef] rounded-xl p-3.5 border border-[#e6dccb] hover:border-[#1f4d3a]/40 transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg border ${s.accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#7d877f]">
                    PHASE 0{s.step}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#1c2621] font-heading">{s.title}</h4>
                <div className="text-[10px] font-medium text-[#1f4d3a] mb-1">{s.subtitle}</div>
                <p className="text-[11px] text-[#4a564f] leading-relaxed pretty-text">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
