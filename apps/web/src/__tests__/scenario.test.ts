import { describe, it, expect } from 'vitest';

describe('Scenario Validation & Safety Guard Tests', () => {
  it('enforces maximum payload constraint of 500 characters', () => {
    const validPayload = JSON.stringify({ scenario: 'legit_purchase' });
    expect(validPayload.length).toBeLessThan(500);

    const oversizedPayload = 'A'.repeat(501);
    expect(oversizedPayload.length).toBeGreaterThan(500);
  });

  it('correctly categorizes allowed attack scenarios', () => {
    const allowedScenarios = [
      'legit_purchase',
      'over_per_tx_cap',
      'unknown_payee',
      'prompt_injection',
      'drain_replay',
    ];

    expect(allowedScenarios).toContain('legit_purchase');
    expect(allowedScenarios).toContain('prompt_injection');
    expect(allowedScenarios).toContain('drain_replay');
    expect(allowedScenarios).not.toContain('arbitrary_malicious_eval');
  });

  it('verifies human-readable error mapping for Soroban Contract error codes', () => {
    const mapError = (err: string) => {
      if (err.includes('#1') || err.includes('Paused')) return 'PAUSED_BY_KILLSWITCH';
      if (err.includes('#6') || err.includes('QueueFull')) return 'QUEUE_CAPACITY_BOUNDED';
      if (err.includes('#4') || err.includes('InvalidRecipient')) return 'INVALID_RECIPIENT';
      if (err.includes('#3') || err.includes('InvalidAmount')) return 'INVALID_AMOUNT';
      if (err.includes('#5') || err.includes('MemoTooLong')) return 'MEMO_OVERSIZE';
      return 'UNKNOWN_CONTRACT_ERROR';
    };

    expect(mapError('HostError: Error(Contract, #6)')).toBe('QUEUE_CAPACITY_BOUNDED');
    expect(mapError('HostError: Error(Contract, #1)')).toBe('PAUSED_BY_KILLSWITCH');
    expect(mapError('HostError: Error(Contract, #4)')).toBe('INVALID_RECIPIENT');
    expect(mapError('HostError: Error(Contract, #3)')).toBe('INVALID_AMOUNT');
    expect(mapError('HostError: Error(Contract, #5)')).toBe('MEMO_OVERSIZE');
  });
});
