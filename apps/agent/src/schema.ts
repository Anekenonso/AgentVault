/**
 * apps/agent/src/schema.ts
 *
 * Strict Zod schema validating LLM tool-call outputs before any contract interaction.
 * Defense-in-depth: Even if the LLM is jailbroken or injected, invalid or malicious
 * parameters are stopped dead at the client schema layer before reaching the blockchain.
 */

import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

/**
 * Converts a valid decimal amount string (e.g. "1.5", "0.0000001", "20") into BigInt base units (7 decimals).
 * Avoids JavaScript floating-point rounding issues.
 */
export function decimalToBaseUnits(decimalStr: string): bigint {
  const parts = decimalStr.trim().split('.');
  const whole = BigInt(parts[0] || '0');
  const fractionStr = (parts[1] || '').padEnd(7, '0').slice(0, 7);
  const fraction = BigInt(fractionStr);
  return whole * 10000000n + fraction;
}

export const ProposePaymentSchema = z.object({
  to: z
    .string()
    .trim()
    .refine(
      (val) => {
        try {
          return StrKey.isValidEd25519PublicKey(val) || StrKey.isValidContract(val);
        } catch {
          return false;
        }
      },
      { message: 'Invalid recipient: must be a valid Stellar public key (G...) or contract address (C...)' }
    ),
  amount: z
    .string()
    .trim()
    .refine(
      (val) => {
        // Must be positive decimal with up to 7 decimal places (stroops precision)
        // Disallows scientific notation (1e7), negative, leading garbage, or >7 decimals
        if (!/^[0-9]+(\.[0-9]{1,7})?$/.test(val)) return false;
        try {
          return decimalToBaseUnits(val) > 0n;
        } catch {
          return false;
        }
      },
      { message: 'Invalid amount: must be a positive decimal with at most 7 fractional digits' }
    ),
  memo: z
    .string()
    .max(64, 'Memo must not exceed 64 bytes')
    .transform((val) => {
      // Strip control characters (\x00-\x1F, \x7F)
      return val.replace(/[\x00-\x1F\x7F]/g, '').trim();
    }),
  invoice_id: z
    .string()
    .min(1, 'invoice_id must not be empty')
    .max(256, 'invoice_id must not exceed 256 characters'),
});

export type ProposePaymentInput = z.infer<typeof ProposePaymentSchema>;

export interface ValidatedPayment {
  to: string;
  amountBaseUnits: bigint;
  memo: string;
  invoiceId: string;
  reasonHashHex: string;
  reasonHashBuffer: Buffer;
}
