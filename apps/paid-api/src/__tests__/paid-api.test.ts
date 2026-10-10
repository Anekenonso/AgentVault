/**
 * apps/paid-api/src/__tests__/paid-api.test.ts
 *
 * Vitest suite for Paid API (HTTP 402 & On-chain Verification):
 * 1. 402 quote flow when no payment headers provided.
 * 2. Malformed headers rejection (non-hex, wrong length).
 * 3. Failed transaction status rejection.
 * 4. Wrong recipient rejection.
 * 5. Amount below price rejection.
 * 6. Wrong reason hash rejection.
 * 7. Transaction on wrong contract rejection.
 * 8. Replayed transaction / invoice rejection (double spend containment).
 * 9. Stale transaction rejection (> maxAgeSeconds).
 * 10. Valid payment happy path returning HTTP 200 and premium data.
 */

import * as crypto from 'crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createPaidApiApp } from '../server.js';
import { PaidApiConfig } from '../verifier.js';

describe('Paid API (HTTP 402 & Soroban Payment Verifier)', () => {
  const dummyVault = 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';
  const dummyMerchant = 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK';

  const config: PaidApiConfig = {
    priceBaseUnits: '10000000', // 1 TUSDC
    asset: 'TUSDC',
    payTo: dummyMerchant,
    vaultContract: dummyVault,
    network: 'testnet',
    maxAgeSeconds: 900, // 15 min
  };

  let mockRpcServer: any;
  let app: any;

  beforeEach(() => {
    mockRpcServer = {
      getTransaction: vi.fn(),
      getEvents: vi.fn(),
    };
    const instance = createPaidApiApp(config, mockRpcServer);
    app = instance.app;
  });

  it('1. Returns HTTP 402 quote when no payment headers provided', async () => {
    const res = await request(app).get('/data?q=crypto-weather');
    expect(res.status).toBe(402);
    expect(res.body.message).toBe('Payment Required');
    expect(res.body.invoice_id).toMatch(/^inv-/);
    expect(res.body.price_base_units).toBe('10000000');
    expect(res.body.pay_to).toBe(dummyMerchant);
    expect(res.body.vault_contract).toBe(dummyVault);
    expect(res.body.network).toBe('testnet');
  });

  it('2. Rejects malformed headers with HTTP 400', async () => {
    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', 'not-a-valid-hex-hash')
      .set('X-Invoice', 'inv-123');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MALFORMED_HEADER');
  });

  it('3. Rejects transaction when RPC returns status != SUCCESS', async () => {
    const fakeHash = 'a'.repeat(64);
    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'FAILED',
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', 'inv-123');

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('TX_NOT_SUCCESSFUL');
  });

  it('4. Rejects payment when recipient is not the designated pay_to address', async () => {
    const fakeHash = 'b'.repeat(64);
    const invoiceId = 'inv-test-recipient';
    const reasonHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: dummyVault,
          topic: ['executed', 1n],
          value: ['GSOME_OTHER_RECIPIENT_ADDRESS', 10000000n, Buffer.from(reasonHash, 'hex'), true],
        },
      ],
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('WRONG_RECIPIENT');
  });

  it('5. Rejects payment when amount is below required price', async () => {
    const fakeHash = 'c'.repeat(64);
    const invoiceId = 'inv-test-amount';
    const reasonHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: dummyVault,
          topic: ['executed', 1n],
          value: [dummyMerchant, 5000000n, Buffer.from(reasonHash, 'hex'), true], // Only 0.5 TUSDC instead of 1.0
        },
      ],
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('AMOUNT_TOO_LOW');
  });

  it('6. Rejects payment when reason_hash does not match sha256(invoice_id)', async () => {
    const fakeHash = 'd'.repeat(64);
    const invoiceId = 'inv-test-reason';
    const wrongReasonHash = crypto.createHash('sha256').update('different-invoice').digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: dummyVault,
          topic: ['executed', 1n],
          value: [dummyMerchant, 10000000n, Buffer.from(wrongReasonHash, 'hex'), true],
        },
      ],
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('WRONG_REASON_HASH');
  });

  it('7. Rejects transaction executed on a different contract', async () => {
    const fakeHash = 'e'.repeat(64);
    const invoiceId = 'inv-test-contract';
    const reasonHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: 'CDIFFERENT_CONTRACT_ID_ON_NETWORK',
          topic: ['executed', 1n],
          value: [dummyMerchant, 10000000n, Buffer.from(reasonHash, 'hex'), true],
        },
      ],
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('NO_VALID_EXECUTED_EVENT');
  });

  it('8. Rejects replayed transaction on subsequent redemption', async () => {
    const fakeHash = 'f'.repeat(64);
    const invoiceId = 'inv-test-replay';
    const reasonHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: dummyVault,
          topic: ['executed', 1n],
          value: [dummyMerchant, 10000000n, Buffer.from(reasonHash, 'hex'), true],
        },
      ],
    });

    // First redemption succeeds
    const firstRes = await request(app)
      .get('/data?q=first-call')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);
    expect(firstRes.status).toBe(200);

    // Second redemption with same tx hash fails
    const secondRes = await request(app)
      .get('/data?q=second-call')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', 'inv-different-id');
    expect(secondRes.status).toBe(402);
    expect(secondRes.body.code).toBe('TX_ALREADY_REDEEMED');
  });

  it('9. Rejects transaction when ledger close time is older than maxAgeSeconds', async () => {
    const fakeHash = '1'.repeat(64);
    const invoiceId = 'inv-test-stale';

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5000000,
      createdAt: Math.floor(Date.now() / 1000) - 1000, // 1000s ago > 900s limit
    });

    const res = await request(app)
      .get('/data')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('TX_TOO_OLD');
  });

  it('10. Happy path: Valid on-chain transaction returns HTTP 200 with data', async () => {
    const fakeHash = '2'.repeat(64);
    const invoiceId = 'inv-happy-path';
    const reasonHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      ledger: 5112600,
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockRpcServer.getEvents.mockResolvedValue({
      events: [
        {
          txHash: fakeHash,
          contractId: dummyVault,
          topic: ['executed', 10n],
          value: [dummyMerchant, 10000000n, Buffer.from(reasonHash, 'hex'), true],
        },
      ],
    });

    const res = await request(app)
      .get('/data?q=alpha-research')
      .set('X-Payment-Tx', fakeHash)
      .set('X-Invoice', invoiceId);

    expect(res.status).toBe(200);
    expect(res.body.data).toContain('alpha-research');
    expect(res.body.invoice_id).toBe(invoiceId);
    expect(res.body.payment_tx).toBe(fakeHash);
    expect(res.body.amount_base_units).toBe('10000000');
  });
});
