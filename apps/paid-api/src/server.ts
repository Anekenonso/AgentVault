/**
 * apps/paid-api/src/server.ts
 *
 * Microservice implementing HTTP 402 "Payment Required" protocol with
 * cryptographic on-chain verification of Soroban AgentVault payments.
 */

import * as crypto from 'crypto';
import express, { Request, Response } from 'express';
import { Networks, rpc } from '@stellar/stellar-sdk';
import { PaidApiConfig, PaymentVerifier } from './verifier.js';

export function createPaidApiApp(config: PaidApiConfig, customRpcServer?: rpc.Server) {
  const rpcServer = customRpcServer || new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
  const app = express();
  app.use(express.json());
  const verifier = new PaymentVerifier(config);

  // Health endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'paid-api', network: config.network });
  });

  // Data query endpoint with 402 paywall
  app.get('/data', async (req: Request, res: Response) => {
    const query = req.query.q as string || 'default';
    const txHash = (req.headers['x-payment-tx'] as string) || '';
    const invoiceId = (req.headers['x-invoice'] as string) || '';

    // If payment headers are absent, return 402 Quote
    if (!txHash && !invoiceId) {
      const newInvoiceId = 'inv-' + crypto.randomUUID();
      return res.status(402).json({
        status: 402,
        message: 'Payment Required',
        invoice_id: newInvoiceId,
        price_base_units: config.priceBaseUnits,
        asset: config.asset,
        pay_to: config.payTo,
        vault_contract: config.vaultContract,
        network: config.network,
      });
    }

    // Verify payment headers
    const verification = await verifier.verifyPayment(txHash, invoiceId, rpcServer);
    if (!verification.valid) {
      const httpStatus = verification.code === 'MALFORMED_HEADER' ? 400 : 402;
      return res.status(httpStatus).json({
        status: httpStatus,
        error: verification.error,
        code: verification.code,
      });
    }

    // Payment successfully verified on-chain! Return paid data
    return res.status(200).json({
      status: 200,
      data: `PREMIUM_DATA: Query "${query}" processed successfully. Authenticated on-chain via AgentVault.`,
      invoice_id: invoiceId,
      payment_tx: txHash,
      amount_base_units: verification.amount,
      ledger: verification.ledger,
      timestamp: new Date().toISOString(),
    });
  });

  return { app, verifier };
}

// Server runner when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 4020;
  const config: PaidApiConfig = {
    priceBaseUnits: process.env.PRICE_BASE_UNITS || '10000000', // 1 TUSDC
    asset: process.env.ASSET || 'TUSDC',
    payTo: process.env.PAY_TO || 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK',
    vaultContract: process.env.VAULT_CONTRACT || 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA',
    network: 'testnet',
    maxAgeSeconds: 900,
    storePath: './data/redeemed-invoices.json',
  };
  const rpcServer = new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
  const { app } = createPaidApiApp(config, rpcServer);

  app.listen(port, () => {
    console.log(`🚀 Paid API server running on http://localhost:${port}`);
    console.log(`Pay-To Merchant: ${config.payTo}`);
    console.log(`Price:          ${config.priceBaseUnits} stroops`);
  });
}
