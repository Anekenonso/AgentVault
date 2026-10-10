import { describe, it, expect } from 'vitest';
import { formatTUSDC, toBaseUnits, shortAddress } from '../lib/stellar.js';

describe('Web Utility & Formatting Tests', () => {
  it('formats stroops / base units to human-readable TUSDC decimal string', () => {
    expect(formatTUSDC(10000000n)).toBe('1.0');
    expect(formatTUSDC(50000000n)).toBe('5.0');
    expect(formatTUSDC(150000000n)).toBe('15.0');
    expect(formatTUSDC(1234567n)).toBe('0.1234567');
    expect(formatTUSDC(0n)).toBe('0.0');
    expect(formatTUSDC('500000000')).toBe('50.0');
  });

  it('converts decimal TUSDC strings to base units correctly', () => {
    expect(toBaseUnits('1.0')).toBe(10000000n);
    expect(toBaseUnits('5.0')).toBe(50000000n);
    expect(toBaseUnits('15.5')).toBe(155000000n);
    expect(toBaseUnits('0.1234567')).toBe(1234567n);
    expect(toBaseUnits('100')).toBe(1000000000n);
  });

  it('correctly truncates decimal places exceeding 7 fractional digits', () => {
    expect(toBaseUnits('1.123456789')).toBe(11234567n);
  });

  it('shortens Stellar G and C addresses properly', () => {
    const gAddr = 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK';
    expect(shortAddress(gAddr)).toBe('GAVC...WBNK');

    const cAddr = 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';
    expect(shortAddress(cAddr)).toBe('CCZQ...2AYA');

    expect(shortAddress('short')).toBe('short');
  });
});
