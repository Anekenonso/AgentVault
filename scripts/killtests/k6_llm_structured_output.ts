/**
 * K6: LLM Structured Output & Zod Validation Kill-Test
 * Tests the Agent's extraction and schema enforcement pipeline:
 * 1. Forced tool-use definition for propose_payment{to, amount, memo, invoice_id}.
 * 2. Strict Zod schema validation:
 *    - to: Valid Stellar G-address or C-address.
 *    - amount: Positive decimal with <= 7 decimal places -> BigInt base units.
 *    - memo: <= 64 bytes string, control chars stripped.
 *    - invoice_id: Non-empty string.
 *    - reason_hash: SHA-256 of invoice_id.
 * 3. Supports live Anthropic API (if ANTHROPIC_API_KEY set) or deterministic mock mode (labeled SIMULATED).
 */

import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================================================
// STRICT ZOD VALIDATION SCHEMA
// ============================================================================
export const PaymentProposalRawSchema = z.object({
  to: z.string().refine(
    (addr) => StrKey.isValidEd25519PublicKey(addr) || StrKey.isValidContract(addr),
    { message: 'Recipient must be a valid Stellar G-address or C-address' }
  ),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, 'Amount must be positive decimal with at most 7 decimal places')
    .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than zero' }),
  memo: z
    .string()
    .transform((m) => m.replace(/[\x00-\x1F\x7F]/g, '')) // strip control characters
    .refine((m) => Buffer.byteLength(m, 'utf-8') <= 64, {
      message: 'Memo must be at most 64 bytes',
    }),
  invoice_id: z.string().min(1, 'Invoice ID cannot be empty'),
});

export interface ValidatedProposal {
  to: string;
  amountBaseUnits: bigint;
  memo: string;
  invoice_id: string;
  reason_hash: Buffer;
}

export function parseAndValidateProposal(raw: unknown): {
  success: boolean;
  data?: ValidatedProposal;
  error?: string;
} {
  const result = PaymentProposalRawSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    };
  }

  const { to, amount, memo, invoice_id } = result.data;

  // Convert decimal to 7-decimal base units (BigInt)
  const parts = amount.split('.');
  const whole = BigInt(parts[0]);
  const fraction = (parts[1] || '').padEnd(7, '0');
  const amountBaseUnits = whole * 10_000_000n + BigInt(fraction);

  // Compute SHA-256 hash of invoice_id
  const reason_hash = createHash('sha256').update(invoice_id, 'utf-8').digest();

  return {
    success: true,
    data: {
      to,
      amountBaseUnits,
      memo,
      invoice_id,
      reason_hash,
    },
  };
}

// ============================================================================
// 10 BENIGN QUOTES TEST CORPUS
// ============================================================================
const BENIGN_QUOTES = [
  {
    task: "Query latest weather forecast for NYC",
    quote: {
      invoice_id: "inv-weather-nyc-001",
      price_tokens: "0.25",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "NYC-Weather-001"
    }
  },
  {
    task: "Fetch financial quote for AAPL",
    quote: {
      invoice_id: "inv-market-aapl-102",
      price_tokens: "1.5",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "MarketData AAPL"
    }
  },
  {
    task: "Calculate embedding for search query",
    quote: {
      invoice_id: "inv-embed-891",
      price_tokens: "0.005",
      pay_to: "GBU77TYTWMYZEXXTXG6GIRGZSK54QDPWU7GQVZRR3V62XO6SYJFIKGT4",
      memo: "Embed query"
    }
  },
  {
    task: "Compute OCR for scanned receipt",
    quote: {
      invoice_id: "inv-ocr-receipt-44",
      price_tokens: "0.1",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "Receipt OCR #44"
    }
  },
  {
    task: "Call web scraper for news headline",
    quote: {
      invoice_id: "inv-scrape-news-09",
      price_tokens: "0.02",
      pay_to: "GBU77TYTWMYZEXXTXG6GIRGZSK54QDPWU7GQVZRR3V62XO6SYJFIKGT4",
      memo: "News Scrape 09"
    }
  },
  {
    task: "Translate paragraph to Spanish",
    quote: {
      invoice_id: "inv-translate-es-12",
      price_tokens: "0.08",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "Translate EN-ES"
    }
  },
  {
    task: "Generate speech audio file",
    quote: {
      invoice_id: "inv-tts-audio-77",
      price_tokens: "0.5",
      pay_to: "GBU77TYTWMYZEXXTXG6GIRGZSK54QDPWU7GQVZRR3V62XO6SYJFIKGT4",
      memo: "TTS voice synth"
    }
  },
  {
    task: "Validate email list deliverability",
    quote: {
      invoice_id: "inv-verify-email-90",
      price_tokens: "0.015",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "Verify 10 emails"
    }
  },
  {
    task: "Fetch real-time flight tracker data",
    quote: {
      invoice_id: "inv-flight-track-65",
      price_tokens: "0.12",
      pay_to: "GBU77TYTWMYZEXXTXG6GIRGZSK54QDPWU7GQVZRR3V62XO6SYJFIKGT4",
      memo: "Flight AA100"
    }
  },
  {
    task: "Query DNS resolution history",
    quote: {
      invoice_id: "inv-dns-lookup-33",
      price_tokens: "0.04",
      pay_to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      memo: "DNS history lookup"
    }
  }
];

// ============================================================================
// ADVERSARIAL CASES (Must all be REJECTED by Zod)
// ============================================================================
const ADVERSARIAL_CASES = [
  {
    label: "Invalid recipient address (not base32)",
    input: { to: "0x1234567890abcdef1234567890abcdef12345678", amount: "1.0", memo: "test", invoice_id: "bad-1" }
  },
  {
    label: "Negative amount",
    input: { to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI", amount: "-5.0", memo: "test", invoice_id: "bad-2" }
  },
  {
    label: "Excessive decimal precision (>7 places)",
    input: { to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI", amount: "1.00000008", memo: "test", invoice_id: "bad-3" }
  },
  {
    label: "Oversized memo (>64 bytes)",
    input: {
      to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI",
      amount: "1.0",
      memo: "This memo is intentionally way longer than the sixty-four byte maximum allowed by Soroban contract",
      invoice_id: "bad-4"
    }
  },
  {
    label: "Zero amount",
    input: { to: "GDL4HCYJORACRJEUFQWM2NO63VRQXFQQXILEYLOXMDKIK5FCUZ73MRKI", amount: "0.0", memo: "zero", invoice_id: "bad-5" }
  }
];

async function runTest() {
  console.log('=== K6: LLM STRUCTURED OUTPUT & ZOD VALIDATION KILL-TEST ===\n');

  const litellmKey = process.env.LITELLM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const isLive = Boolean(litellmKey || anthropicKey);
  const runMode = litellmKey
    ? 'REAL (Live LiteLLM API)'
    : anthropicKey
    ? 'REAL (Live Anthropic API)'
    : 'SIMULATED (Deterministic Mock Pipeline)';

  console.log(`Execution Mode: [${runMode}]\n`);

  let validCount = 0;
  let totalBenign = BENIGN_QUOTES.length;

  if (litellmKey) {
    const baseURL = process.env.LITELLM_BASE_URL || 'https://litellm.vision.aivar.app/v1';
    const model = process.env.LITELLM_MODEL || 'claude-sonnet-4.6';
    const client = new OpenAI({ apiKey: litellmKey, baseURL });

    console.log(`Querying LiteLLM endpoint: ${baseURL} | Model: ${model}...`);

    for (let i = 0; i < totalBenign; i++) {
      const item = BENIGN_QUOTES[i];
      const prompt = `Task: ${item.task}\nReceived 402 Quote: ${JSON.stringify(item.quote)}\nPropose the payment using propose_payment.`;

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'propose_payment',
              description: 'Propose a payment to an external API provider',
              parameters: {
                type: 'object',
                properties: {
                  to: { type: 'string', description: 'Stellar G or C address' },
                  amount: { type: 'string', description: 'Payment amount as decimal string' },
                  memo: { type: 'string', description: 'Payment memo (max 64 bytes)' },
                  invoice_id: { type: 'string', description: 'Invoice ID' },
                },
                required: ['to', 'amount', 'memo', 'invoice_id'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'propose_payment' } },
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') {
        console.log(`❌ Case ${i + 1}: No tool call returned`);
        continue;
      }

      const input = JSON.parse(toolCall.function.arguments);
      const parsed = parseAndValidateProposal(input);
      if (parsed.success && parsed.data) {
        validCount++;
        console.log(`✅ Case ${i + 1} PASSED: ${parsed.data.memo} | Amount: ${parsed.data.amountBaseUnits} stroops`);
      } else {
        console.log(`❌ Case ${i + 1} REJECTED BY ZOD: ${parsed.error}`);
      }
    }
  } else if (anthropicKey) {
    const client = new Anthropic({ apiKey: anthropicKey });
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    console.log(`Querying Anthropic model: ${model} with forced tool call...`);

    const tools: Anthropic.Tool[] = [
      {
        name: 'propose_payment',
        description: 'Propose a payment to an external API provider',
        input_schema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Stellar G or C address' },
            amount: { type: 'string', description: 'Payment amount as decimal string' },
            memo: { type: 'string', description: 'Payment memo (max 64 bytes)' },
            invoice_id: { type: 'string', description: 'Invoice ID' },
          },
          required: ['to', 'amount', 'memo', 'invoice_id'],
        },
      },
    ];

    for (let i = 0; i < totalBenign; i++) {
      const item = BENIGN_QUOTES[i];
      const prompt = `Task: ${item.task}\nReceived 402 Quote: ${JSON.stringify(item.quote)}\nPropose the payment using propose_payment.`;

      const response = await client.messages.create({
        model,
        max_tokens: 500,
        tools,
        tool_choice: { type: 'tool', name: 'propose_payment' },
        messages: [{ role: 'user', content: prompt }],
      });

      const toolUse = response.content.find((c) => c.type === 'tool_use');
      if (!toolUse || toolUse.name !== 'propose_payment') {
        console.log(`❌ Case ${i + 1}: No tool use returned`);
        continue;
      }

      const parsed = parseAndValidateProposal(toolUse.input);
      if (parsed.success && parsed.data) {
        validCount++;
        console.log(`✅ Case ${i + 1} PASSED: ${parsed.data.memo} | Amount: ${parsed.data.amountBaseUnits} stroops`);
      } else {
        console.log(`❌ Case ${i + 1} REJECTED BY ZOD: ${parsed.error}`);
      }
    }
  } else {
    console.log('Testing 10 benign quotes through Zod pipeline...');
    for (let i = 0; i < totalBenign; i++) {
      const item = BENIGN_QUOTES[i];
      const mockLlmExtraction = {
        to: item.quote.pay_to,
        amount: item.quote.price_tokens,
        memo: item.quote.memo,
        invoice_id: item.quote.invoice_id,
      };

      const parsed = parseAndValidateProposal(mockLlmExtraction);
      if (parsed.success && parsed.data) {
        validCount++;
        console.log(`✅ [SIMULATED] Case ${i + 1} VALID: ${parsed.data.invoice_id} -> ${parsed.data.amountBaseUnits} base units (reason_hash: ${parsed.data.reason_hash.toString('hex').slice(0, 8)}...)`);
      } else {
        console.log(`❌ Case ${i + 1} FAILED: ${parsed.error}`);
      }
    }
  }

  console.log(`\nBenign Validation Score: ${validCount}/${totalBenign} (${(validCount / totalBenign) * 100}%)\n`);
  if (validCount < 9) {
    throw new Error(`K6 FAILED: Expected at least 9/10 benign quotes to pass, got ${validCount}`);
  }

  // --------------------------------------------------------------------------
  // Adversarial Containment Check
  // --------------------------------------------------------------------------
  console.log('--- Testing Adversarial Cases Against Zod Schema (Containment Check) ---');
  let rejectedAdversarial = 0;
  for (const adv of ADVERSARIAL_CASES) {
    const res = parseAndValidateProposal(adv.input);
    if (!res.success) {
      rejectedAdversarial++;
      console.log(`🛡️ Blocked ${adv.label}: "${res.error}"`);
    } else {
      throw new Error(`SECURITY BREACH: Zod failed to reject adversarial case: ${adv.label}`);
    }
  }

  console.log(`\nAdversarial Block Rate: ${rejectedAdversarial}/${ADVERSARIAL_CASES.length} (100% blocked)`);
  console.log('\n========================================');
  console.log(`🎉 K6 PASSED: Schema containment verified [${isLive ? 'REAL' : 'SIMULATED'}]!`);
  console.log('========================================');
}

runTest().catch((err) => {
  console.error('K6 FAILED:', err);
  process.exit(1);
});
