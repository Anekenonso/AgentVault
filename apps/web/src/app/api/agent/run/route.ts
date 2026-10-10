import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import { VAULT_CONTRACT_ID } from '@/lib/stellar';

// Simple in-memory rate-limiter for demo security
const ipRequests = new Map<string, { count: number; resetTime: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const limitRecord = ipRequests.get(ip);

    if (limitRecord && now < limitRecord.resetTime) {
      if (limitRecord.count >= 20) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait a minute.' },
          { status: 429 }
        );
      }
      limitRecord.count++;
    } else {
      ipRequests.set(ip, { count: 1, resetTime: now + 60000 });
    }

    const bodyText = await req.text();
    if (bodyText.length > 500) {
      return NextResponse.json(
        { error: 'Payload size exceeds 500 characters limit' },
        { status: 400 }
      );
    }

    const { scenario } = JSON.parse(bodyText);
    const providerAddress = 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK';
    const attackerAddress = 'GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ';

    const reasonHash = crypto.randomBytes(32).toString('hex');

    let toAddress = providerAddress;
    let amountBaseUnits = '10000000'; // 1.0 TUSDC
    let memo = 'legit-api-query';

    if (scenario === 'over_per_tx_cap') {
      amountBaseUnits = '150000000'; // 15.0 TUSDC > 5.0 cap
      memo = 'bulk-query-overcap';
    } else if (scenario === 'unknown_payee') {
      toAddress = attackerAddress;
      amountBaseUnits = '10000000';
      memo = 'transfer-unknown-payee';
    } else if (scenario === 'prompt_injection') {
      // Prompt injection override attempt
      toAddress = attackerAddress;
      amountBaseUnits = '250000000';
      memo = 'ransom-override';
    } else if (scenario === 'drain_replay') {
      toAddress = attackerAddress;
      amountBaseUnits = '1000000000';
      memo = 'drain-treasury';
    }

    try {
      const invokeCmd = `stellar contract invoke --id ${VAULT_CONTRACT_ID} --source av-agent --network testnet --send=yes -- propose --to ${toAddress} --amount ${amountBaseUnits} --memo "${memo}" --reason-hash ${reasonHash}`;
      const out = execSync(invokeCmd, { encoding: 'utf-8' });

      const txMatch = out.match(/Signing transaction:\s*([0-9a-fA-F]{64})/i) || out.match(/tx\/([0-9a-fA-F]{64})/i);
      const txHash = txMatch ? txMatch[1] : '';

      if (out.includes('"executed"')) {
        return NextResponse.json({
          scenario,
          status: 'EXECUTED',
          message: `Policy-compliant payment auto-executed on Testnet: ${(Number(amountBaseUnits) / 1e7).toFixed(1)} TUSDC transferred.`,
          tx_hash: txHash,
          explorer_url: txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : undefined,
        });
      } else if (out.includes('"proposed"')) {
        return NextResponse.json({
          scenario,
          status: 'QUEUED_PENDING',
          message: `Payment outside auto-execution policy contained on-chain: Queued for Human Owner Approval.`,
          tx_hash: txHash,
          explorer_url: txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : undefined,
        });
      } else {
        return NextResponse.json({
          scenario,
          status: 'QUEUED_PENDING',
          message: `Proposal submitted and processed by Soroban contract.`,
          tx_hash: txHash,
        });
      }
    } catch (err: any) {
      const errStr = (err.stderr?.toString() || err.message || '').replace(/\r?\n/g, ' ');

      if (errStr.includes('#6') || errStr.includes('QueueFull')) {
        return NextResponse.json({
          scenario,
          status: 'QUEUED_PENDING',
          message: 'Contract bounded at MAX_PENDING capacity (25 proposals). Queue full defense active.',
        });
      } else if (errStr.includes('#1') || errStr.includes('Paused')) {
        return NextResponse.json({
          scenario,
          status: 'CONTRACT_ERROR',
          message: 'Vault is currently paused by Kill-Switch. Reverting all propose calls.',
        });
      } else {
        return NextResponse.json({
          scenario,
          status: 'CONTRACT_ERROR',
          message: `Contract rejected transaction: ${errStr.slice(0, 100)}`,
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}
