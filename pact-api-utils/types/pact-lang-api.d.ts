/*

The pact-lang-api library is written in JavaScript, but we'd like to have types
available to guide our development. This file implements types for v4.3.5.

Note: These types only cover the functions and data we are using from the
pact-lang-api library. The library includes more than you see here, but this is
enough for Goliath!

Library source:
https://github.com/kadena-io/pact-lang-api

*/

declare module "pact-lang-api" {
  // Pact can represent huge integers and decimal values, but it has the
  // restriction that particularly large values are stringified, and decimals
  // must have a decimal point.
  interface PactInt {
    int: string;
  }

  interface PactDecimal {
    decimal: string;
  }

  type PactValue =
    | string
    | PactInt
    | PactDecimal
    | boolean
    | PactValue[]
    | { [key: string]: PactValue };

  interface KeyPair {
    publicKey: string;
    secretKey: string;
  }

  interface KeySet {
    keys: string[];
    pred: string;
  }

  interface KeyPairCapabilities extends KeyPair {
    clist?: CapabilitySignature[];
  }

  interface CapabilitySignature {
    name: string;
    args: PactValue[];
  }

  interface TransactionMetadata {
    creationTime: number;
    ttl: number;
    gasLimit: number;
    gasPrice: number;
    chainId: string;
    sender: string;
  }

  interface ExecCmd<a> {
    networkId: string;
    type?: "exec" | "cont";
    keyPairs?: KeyPairCapabilities | KeyPairCapabilities[];
    nonce?: string;
    envData?: { [key: string]: PactValue | KeySet };
    pactCode: string;
    meta: TransactionMetadata;
  }

  interface LocalCmd {
    pactCode: string;
    meta: TransactionMetadata;
  }

  interface PollCmd {
    requestKeys: string[];
  }

  interface ListenCmd {
    listen: string; // request key
  }

  /*
  Miscellaneous helper types for requests
  */

  interface ExecResponseMetadata {
    blockHeight: number;
    blockTime: number;
    prevBlockHash: string;
  }

  interface LocalResponseMetadata extends ExecResponseMetadata {
    publicMeta: TransactionMetadata;
  }

  interface TransactionEvent {
    module: { namespace: string | null; name: string };
    moduleHash: string;
    name: string;
    params: string[];
  }

  interface SuccessResult {
    status: "success";
    data: PactValue;
  }

  interface FailureResult {
    status: "failure";
    error: {
      callStack: string[];
      type: string;
      message: string;
      info: string;
    };
  }

  type RequestError = string;

  interface ExecTransactionResponse {
    continuation: null;
    events: TransactionEvent[] | null;
    gas: number;
    metaData: ExecResponseMetadata;
    logs: string;
    reqKey: string;
    txId: number | null;
  }

  interface FailedExecTransactionResponse extends ExecTransactionResponse {
    result: FailureResult;
  }

  interface SuccessExecTransactionResponse extends ExecTransactionResponse {
    result: SuccessResult;
  }

  /* The /local endpoint */
  interface LocalResponse {
    continuation: null;
    gas: number;
    result: FailureResult | SuccessResult;
    metaData: LocalResponseMetadata;
    logs: string;
    reqKey: string;
    txId: number | null;
  }

  /* The /send endpoint */
  interface SendResponse {
    requestKeys: string[];
  }

  /* The /poll endpoint */
  type PollResponse = {
    [requestKey: string]:
      | FailedExecTransactionResponse
      | SuccessExecTransactionResponse;
  };

  /*
  Finally, we reach the concrete values exported by pact-lang-api. The interface
  and exports here exactly match the exports we are using from the library, so
  we can use those functions exactly as they would be used in JavaScript.
  However, we now have types to help guide our development:
  https://github.com/kadena-io/pact-lang-api/blob/666ab149d0db5e0360d6ff1206bd6dce45ded07a/pact-lang-api.js#L842
  */
  interface ICrypto {
    genKeyPair: () => KeyPair;
  }

  const crypto: ICrypto;

  interface IFetch {
    local: (
      cmd: LocalCmd,
      apiHost: string
    ) => Promise<RequestError | LocalResponse>;

    send: (
      cmd: ExecCmd<any> | ExecCmd<any>[],
      apiHost: string
    ) => Promise<RequestError | SendResponse>;

    poll: (
      cmd: PollCmd,
      apiHost: string
    ) => Promise<RequestError | PollResponse>;
  }

  const fetch: IFetch;
}
