import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import {
  Keypair,
  Networks,
  rpc,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { VAULT_CONTRACT_ID, RPC_URL, decodeSorobanError } from '@/lib/stellar';

// Simple in-memory rate-limiter for demo security
const ipRequests = new Map<string, { count: number; resetTime: number }>();

const rpcServer = new rpc.Server(RPC_URL);

// Agent key: use env var if present, or verified Testnet agent keypair
const AGENT_SECRET =
  process.env.STELLAR_AGENT_SECRET_KEY ||
  process.env.AGENT_SECRET_KEY ||
  'SADFTJJPHPBI5NTWTTGMO7DXMVA46ITXA4AIBFN6XJJA7ELAY2L67A3N';

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
    const providerAddress =
      process.env.NEXT_PUBLIC_PROVIDER_ADDRESS ||
      'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK';
    const attackerAddress =
      process.env.NEXT_PUBLIC_ATTACKER_ADDRESS ||
      'GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ';

    const reasonHashHex = crypto.randomBytes(32).toString('hex');
    const reasonHashBuf = Buffer.from(reasonHashHex, 'hex');

    let toAddress = providerAddress;
    let amountBaseUnits = '10000000'; // 1.0 TUSDC
    let memo = 'legit-api-query';

    if (scenario === 'over_per_tx_cap') {
      amountBaseUnits = '150000000'; // 15.0 TUSDC > 5.0 cap
      memo = 'bulk-query-overcap';
    } else if (scenario === 'unknown_payee') {
      toAddress = attackerAddress;
      amountBaseUnits = '30000000'; // 3.0 TUSDC
      memo = 'transfer-unknown-payee';
    } else if (scenario === 'prompt_injection') {
      toAddress = attackerAddress;
      amountBaseUnits = '100000000'; // 10.0 TUSDC
      memo = 'ransom-override';
    } else if (scenario === 'drain_replay') {
      toAddress = attackerAddress;
      amountBaseUnits = '500000000'; // 50.0 TUSDC
      memo = 'drain-treasury';
    }

    try {
      const agentKeypair = Keypair.fromSecret(AGENT_SECRET);
      const account = await rpcServer.getAccount(agentKeypair.publicKey());
      const contract = new Contract(VAULT_CONTRACT_ID);

      const tx = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            'propose',
            new Address(toAddress).toScVal(),
            nativeToScVal(BigInt(amountBaseUnits), { type: 'i128' }),
            nativeToScVal(reasonHashBuf, { type: 'bytes' }),
            nativeToScVal(memo, { type: 'string' })
          )
        )
        .setTimeout(30)
        .build();

      const preparedTx = await rpcServer.prepareTransaction(tx);
      preparedTx.sign(agentKeypair);

      const sendRes = await rpcServer.sendTransaction(preparedTx);
      if (sendRes.status === 'ERROR') {
        const errDetail =
          (sendRes as any).errorResult ||
          (sendRes as any).errorResultXdr ||
          'Transaction submission error';
        throw new Error(decodeSorobanError(errDetail));
      }

      const txHash = sendRes.hash;
      let returnStatus = 0; // 0 = Pending, 1 = Executed
      let proposalId = 0;

      // Poll up to 10s for ledger finality
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const txInfo = await rpcServer.getTransaction(txHash);
        if (txInfo.status === 'SUCCESS') {
          if (txInfo.returnValue) {
            const ret = scValToNative(txInfo.returnValue);
            if (Array.isArray(ret)) {
              proposalId = Number(ret[0]);
              returnStatus = Number(ret[1]);
            }
          }
          break;
        } else if (txInfo.status === 'FAILED') {
          throw new Error('Transaction execution failed on-chain.');
        }
      }

      if (returnStatus === 1) {
        return NextResponse.json({
          scenario,
          status: 'EXECUTED',
          message: `Policy-compliant payment auto-executed on Testnet: ${(
            Number(amountBaseUnits) / 1e7
          ).toFixed(1)} TUSDC transferred.`,
          tx_hash: txHash,
          proposal_id: proposalId || undefined,
          explorer_url: txHash
            ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
            : undefined,
        });
      } else {
        return NextResponse.json({
          scenario,
          status: 'QUEUED_PENDING',
          message: `Payment outside auto-execution policy contained on-chain: Queued for Human Owner Approval.`,
          tx_hash: txHash,
          proposal_id: proposalId || undefined,
          explorer_url: txHash
            ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
            : undefined,
        });
      }
    } catch (err: any) {
      const errStr = decodeSorobanError(err);

      if (errStr.includes('#6') || errStr.includes('QueueFull')) {
        return NextResponse.json({
          scenario,
          status: 'QUEUED_PENDING',
          message:
            'Contract bounded at MAX_PENDING capacity (25 proposals). Queue full defense active.',
        });
      } else if (errStr.includes('#1') || errStr.includes('Paused')) {
        return NextResponse.json({
          scenario,
          status: 'CONTRACT_ERROR',
          message:
            'Vault is currently paused by Kill-Switch. Reverting all propose calls.',
        });
      } else {
        return NextResponse.json({
          scenario,
          status: 'CONTRACT_ERROR',
          message: `Contract rejected transaction: ${errStr.slice(0, 150)}`,
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal processing error: ' + (err?.message || '') },
      { status: 500 }
    );
  }
}
