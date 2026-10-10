import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA",
  }
} as const

export const Errors = {
  1: {message:"Paused"},
  2: {message:"PolicyExpired"},
  3: {message:"InvalidAmount"},
  4: {message:"InvalidRecipient"},
  5: {message:"MemoTooLong"},
  6: {message:"QueueFull"},
  7: {message:"InsufficientFunds"},
  8: {message:"NotPending"},
  9: {message:"ProposalExpired"},
  10: {message:"NotFound"},
  11: {message:"InvalidPolicy"},
  12: {message:"AllowlistTooLarge"},
  13: {message:"Overflow"},
  14: {message:"NotExpired"},
  15: {message:"AlreadyInitialized"}
}


export interface Policy {
  daily_cap: i128;
  per_tx_cap: i128;
  policy_expires_at: u64;
  proposal_ttl_secs: u64;
}

export enum Status {
  Pending = 0,
  Executed = 1,
  Rejected = 2,
  Expired = 3,
}


export interface Proposal {
  amount: i128;
  auto: boolean;
  created_at: u64;
  id: u64;
  memo: string;
  reason_hash: Buffer;
  status: Status;
  to: string;
}


export interface VaultConfig {
  agent: string;
  allowlist: Array<string>;
  next_id: u64;
  owner: string;
  paused: boolean;
  pending_count: u32;
  policy: Policy;
  token: string;
}

export interface Client {
  /**
   * Construct and simulate a bump transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Anyone can extend contract instance TTL to prevent archival.
   */
  bump: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency pause kill-switch (owner only).
   */
  pause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reject transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner rejects a pending proposal. Allowed while paused.
   */
  reject: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner approves a pending proposal.
   * Does not consume the autonomous agent spending allowance.
   */
  approve: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a propose transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Autonomous payment proposal by the agent key.
   * Executes immediately if within policy and allowlisted, else enqueues as Pending.
   */
  propose: ({to, amount, reason_hash, memo}: {to: string, amount: i128, reason_hash: Buffer, memo: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [u64, Status]>>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpause vault operations (owner only).
   */
  unpause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner withdraws funds directly from vault (always permitted, even while paused).
   */
  withdraw: ({to, amount}: {to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_agent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotate or revoke agent session key (owner only).
   */
  set_agent: ({new_agent}: {new_agent: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<VaultConfig>>

  /**
   * Construct and simulate a set_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update spending policy (owner only).
   */
  set_policy: ({policy}: {policy: Policy}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_proposal: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Proposal>>>

  /**
   * Construct and simulate a get_proposals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_proposals: ({start_id, limit}: {start_id: u64, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Proposal>>>

  /**
   * Construct and simulate a purge_expired transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Publicly callable cleanup of expired pending proposals.
   */
  purge_expired: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_allowlist transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update allowlist of authorized recipients (owner only, max 32).
   */
  set_allowlist: ({list}: {list: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a spent_in_window transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  spent_in_window: (options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a remaining_allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remaining_allowance: (options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {owner, agent, token, policy}: {owner: string, agent: string, token: string, policy: Policy},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({owner, agent, token, policy}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAADxBbnlvbmUgY2FuIGV4dGVuZCBjb250cmFjdCBpbnN0YW5jZSBUVEwgdG8gcHJldmVudCBhcmNoaXZhbC4AAAAEYnVtcAAAAAAAAAAA",
        "AAAAAAAAAClFbWVyZ2VuY3kgcGF1c2Uga2lsbC1zd2l0Y2ggKG93bmVyIG9ubHkpLgAAAAAAAAVwYXVzZQAAAAAAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAADdPd25lciByZWplY3RzIGEgcGVuZGluZyBwcm9wb3NhbC4gQWxsb3dlZCB3aGlsZSBwYXVzZWQuAAAAAAZyZWplY3QAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAFxPd25lciBhcHByb3ZlcyBhIHBlbmRpbmcgcHJvcG9zYWwuCkRvZXMgbm90IGNvbnN1bWUgdGhlIGF1dG9ub21vdXMgYWdlbnQgc3BlbmRpbmcgYWxsb3dhbmNlLgAAAAdhcHByb3ZlAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAH5BdXRvbm9tb3VzIHBheW1lbnQgcHJvcG9zYWwgYnkgdGhlIGFnZW50IGtleS4KRXhlY3V0ZXMgaW1tZWRpYXRlbHkgaWYgd2l0aGluIHBvbGljeSBhbmQgYWxsb3dsaXN0ZWQsIGVsc2UgZW5xdWV1ZXMgYXMgUGVuZGluZy4AAAAAAAdwcm9wb3NlAAAAAAQAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC3JlYXNvbl9oYXNoAAAAA+4AAAAgAAAAAAAAAARtZW1vAAAAEAAAAAEAAAPpAAAD7QAAAAIAAAAGAAAH0AAAAAZTdGF0dXMAAAAAAAM=",
        "AAAAAAAAACZVbnBhdXNlIHZhdWx0IG9wZXJhdGlvbnMgKG93bmVyIG9ubHkpLgAAAAAAB3VucGF1c2UAAAAAAAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAFBPd25lciB3aXRoZHJhd3MgZnVuZHMgZGlyZWN0bHkgZnJvbSB2YXVsdCAoYWx3YXlzIHBlcm1pdHRlZCwgZXZlbiB3aGlsZSBwYXVzZWQpLgAAAAh3aXRoZHJhdwAAAAIAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAADBSb3RhdGUgb3IgcmV2b2tlIGFnZW50IHNlc3Npb24ga2V5IChvd25lciBvbmx5KS4AAAAJc2V0X2FnZW50AAAAAAAAAQAAAAAAAAAJbmV3X2FnZW50AAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAAC1ZhdWx0Q29uZmlnAA==",
        "AAAAAAAAACRVcGRhdGUgc3BlbmRpbmcgcG9saWN5IChvd25lciBvbmx5KS4AAAAKc2V0X3BvbGljeQAAAAAAAQAAAAAAAAAGcG9saWN5AAAAAAfQAAAABlBvbGljeQAAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3Bvc2FsAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAIUHJvcG9zYWw=",
        "AAAAAAAAAE1BdG9taWMgY29uc3RydWN0b3IgaW5pdGlhbGl6aW5nIG93bmVyLCBhZ2VudCwgdG9rZW4gU0FDLCBhbmQgc3BlbmRpbmcgcG9saWN5LgAAAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVhZ2VudAAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGcG9saWN5AAAAAAfQAAAABlBvbGljeQAAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAANZ2V0X3Byb3Bvc2FscwAAAAAAAAIAAAAAAAAACHN0YXJ0X2lkAAAABgAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+oAAAfQAAAACFByb3Bvc2Fs",
        "AAAAAAAAADdQdWJsaWNseSBjYWxsYWJsZSBjbGVhbnVwIG9mIGV4cGlyZWQgcGVuZGluZyBwcm9wb3NhbHMuAAAAAA1wdXJnZV9leHBpcmVkAAAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAD9VcGRhdGUgYWxsb3dsaXN0IG9mIGF1dGhvcml6ZWQgcmVjaXBpZW50cyAob3duZXIgb25seSwgbWF4IDMyKS4AAAAADXNldF9hbGxvd2xpc3QAAAAAAAABAAAAAAAAAARsaXN0AAAD6gAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAPc3BlbnRfaW5fd2luZG93AAAAAAAAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAATcmVtYWluaW5nX2FsbG93YW5jZQAAAAAAAAAAAQAAA+kAAAALAAAAAw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADwAAAAAAAAAGUGF1c2VkAAAAAAABAAAAAAAAAA1Qb2xpY3lFeHBpcmVkAAAAAAAAAgAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAMAAAAAAAAAEEludmFsaWRSZWNpcGllbnQAAAAEAAAAAAAAAAtNZW1vVG9vTG9uZwAAAAAFAAAAAAAAAAlRdWV1ZUZ1bGwAAAAAAAAGAAAAAAAAABFJbnN1ZmZpY2llbnRGdW5kcwAAAAAAAAcAAAAAAAAACk5vdFBlbmRpbmcAAAAAAAgAAAAAAAAAD1Byb3Bvc2FsRXhwaXJlZAAAAAAJAAAAAAAAAAhOb3RGb3VuZAAAAAoAAAAAAAAADUludmFsaWRQb2xpY3kAAAAAAAALAAAAAAAAABFBbGxvd2xpc3RUb29MYXJnZQAAAAAAAAwAAAAAAAAACE92ZXJmbG93AAAADQAAAAAAAAAKTm90RXhwaXJlZAAAAAAADgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAAP",
        "AAAAAQAAAAAAAAAAAAAABlBvbGljeQAAAAAABAAAAAAAAAAJZGFpbHlfY2FwAAAAAAAACwAAAAAAAAAKcGVyX3R4X2NhcAAAAAAACwAAAAAAAAARcG9saWN5X2V4cGlyZXNfYXQAAAAAAAAGAAAAAAAAABFwcm9wb3NhbF90dGxfc2VjcwAAAAAAAAY=",
        "AAAAAwAAAAAAAAAAAAAABlN0YXR1cwAAAAAABAAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAhFeGVjdXRlZAAAAAEAAAAAAAAACFJlamVjdGVkAAAAAgAAAAAAAAAHRXhwaXJlZAAAAAAD",
        "AAAAAQAAAAAAAAAAAAAACFByb3Bvc2FsAAAACAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAARhdXRvAAAAAQAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAACaWQAAAAAAAYAAAAAAAAABG1lbW8AAAAQAAAAAAAAAAtyZWFzb25faGFzaAAAAAPuAAAAIAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAJ0bwAAAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAC1ZhdWx0Q29uZmlnAAAAAAgAAAAAAAAABWFnZW50AAAAAAAAEwAAAAAAAAAJYWxsb3dsaXN0AAAAAAAD6gAAABMAAAAAAAAAB25leHRfaWQAAAAABgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAAAAAAADXBlbmRpbmdfY291bnQAAAAAAAAEAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAAGUG9saWN5AAAAAAAAAAAABXRva2VuAAAAAAAAEw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    bump: this.txFromJSON<null>,
        pause: this.txFromJSON<Result<void>>,
        reject: this.txFromJSON<Result<void>>,
        approve: this.txFromJSON<Result<void>>,
        balance: this.txFromJSON<i128>,
        propose: this.txFromJSON<Result<readonly [u64, Status]>>,
        unpause: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<void>>,
        set_agent: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<VaultConfig>,
        set_policy: this.txFromJSON<Result<void>>,
        get_proposal: this.txFromJSON<Option<Proposal>>,
        get_proposals: this.txFromJSON<Array<Proposal>>,
        purge_expired: this.txFromJSON<Result<void>>,
        set_allowlist: this.txFromJSON<Result<void>>,
        spent_in_window: this.txFromJSON<Result<i128>>,
        remaining_allowance: this.txFromJSON<Result<i128>>
  }
}