/*

This file implements the functions and types used in the "goliath-faucet"
contract that we implemented in Project 1. I have lightly commented these
requests, but for the most part these are reimplementing the fully-commented
request files from the 01-faucet-contract/yaml directory on top of the request
types we implemented in our frontend. If you get stuck on a function, I
recommend that you:

1. Read the matching function in the 01-faucet-contract/faucet.pact contract
2. Look at the matching request file in the 01-faucet-contract/yaml directory
3. Look at how the request is called in the 01-faucet-contract/faucet.repl file
4. Look at how the request types are defined (ie. SendRequest)

If you still feel stuck, please open an issue!
*/

import Pact, { KeyPair, KeyPairCapabilities, PactDecimal } from "pact-lang-api";
import { faucetAccount } from "../accounts";
import { formatPactCode } from "../pact-utils/pact-code";
import { DEFAULT_CHAIN, GAS_PRICE, HOST_NAME, NETWORK_ID, TTL } from "../config";
import { buildRequest, PactRequest } from "../pact-utils/request-builder";
import { creationTime, defaultLocalCmd, coercePactValue } from "./utils";

// Corresponds with constants defined in the 'goliath-faucet smart contract.
export const FAUCET_ACCOUNT = "goliath-faucet";
export const DEFAULT_REQUEST_LIMIT = { decimal: "20.0" };
export const DEFAULT_ACCOUNT_LIMIT = { decimal: "100.0" };

// Our first function is the (request-funds) function from the contract. These
// are the arguments it takes, which ought to be configurable in our app:
export interface RequestFundsArgs {
  targetAddress: string;
  targetAddressKeySet: Pact.KeySet;
  amount: Pact.PactDecimal;
}

// Next, we can create our 'requestFunds' request which corresponds with the
// (request-funds) function defined in the faucet contract. Take a read through
// the ExecCmd we create here; if you'd like more details on why we chose the
// values in these fields, please see the request-funds.yaml file in the faucet
// contract project:
// 01-faucet-contract/yaml/send/request-funds.yaml
export const requestFunds: PactRequest<RequestFundsArgs, string> = buildRequest(HOST_NAME, {
  type: "send",
  // This will automatically parse to our result type (string, in this case).
  parse: (response) => response as string,
  build: ({ targetAddress, targetAddressKeySet, amount }, chainId): Pact.ExecCmd => {
    // The code to be executed on the Chainweb node
    const code = {
      cmd: "free.goliath-faucet.request-funds",
      args: [targetAddress, { cmd: "read-keyset", args: ["target-keyset"] }, amount],
    };

    // The transaction data to include with the transaction
    const envData = { "target-keyset": targetAddressKeySet };

    // The keys that should be used to sign the transaction, along with the caps
    // to scope their signature to
    const keyPairs: Pact.KeyPairCapabilities = {
      ...faucetAccount.keys,
      clist: [
        { name: "coin.TRANSFER", args: [FAUCET_ACCOUNT, targetAddress, amount] },
        { name: "coin.GAS", args: [] },
      ],
    };

    // The public metadata to associate with the transaction.
    const meta: Pact.TransactionMetadata = {
      creationTime: creationTime(),
      gasPrice: GAS_PRICE,
      ttl: TTL,
      chainId: chainId ?? DEFAULT_CHAIN,
      gasLimit: 2500,
      sender: faucetAccount.address,
    };

    return { networkId: NETWORK_ID, pactCode: formatPactCode(code), envData, keyPairs, meta };
  },
});

// Now, we'll implement the (get-limits) function, which lets you look up the
// current per-request and per-account limits associated with an address that
// has used the faucet.

export interface GetLimitsArgs {
  address: string;
}

// The type corresponding with the data returned by (get-limits)
export interface GetLimitsResponse {
  "account-limit": number;
  "request-limit": number;
  "account-limit-remaining": number;
}

// Fetch the current limits for the given address, if it has used the faucet
// before. See also:
// 01-faucet-contract/yaml/local/user-limits.yaml
export const getLimits: PactRequest<GetLimitsArgs, GetLimitsResponse> = buildRequest(HOST_NAME, {
  type: "local",
  parse: (response) => coercePactValue(response),
  build: ({ address }, chainId): Pact.ExecCmd => {
    const code = {
      cmd: "free.goliath-faucet.get-limits",
      args: [address],
    };
    return defaultLocalCmd(code, undefined, chainId);
  },
});

// Next, we have the (set-request-limit) and (set-account-limit) functions.

export interface SetRequestLimitArgs {
  account: string;
  amount: Pact.PactDecimal;
}

// Set the per-request limit for an account. See also:
// 01-faucet-contract/yaml/send/set-user-request-limit.yaml
export const setRequestLimit: PactRequest<SetRequestLimitArgs, string> = buildRequest(HOST_NAME, {
  type: "send",
  parse: (response) => response as string,
  build: ({ account, amount }, chainId) => {
    const code = {
      cmd: "free.goliath-faucet.set-request-limit",
      args: [account, amount],
    };

    const keyPairs: KeyPairCapabilities = {
      ...faucetAccount.keys,
      clist: [
        { name: "free.goliath-faucet.SET_LIMIT", args: [] },
        { name: "coin.GAS", args: [] },
      ],
    };

    const meta: Pact.TransactionMetadata = {
      creationTime: creationTime(),
      gasPrice: GAS_PRICE,
      ttl: TTL,
      chainId: chainId ?? DEFAULT_CHAIN,
      gasLimit: 500,
      sender: faucetAccount.address,
    };

    return { networkId: NETWORK_ID, pactCode: formatPactCode(code), keyPairs, meta };
  },
});

export interface SetAccountLimitArgs {
  account: string;
  amount: Pact.PactDecimal;
}

// Set the per-account limit for an account. See also:
// 01-faucet-contract/yaml/send/set-user-account-limit.yaml
export const setAccountLimit: PactRequest<SetAccountLimitArgs, string> = buildRequest(HOST_NAME, {
  type: "send",
  parse: (response) => response as string,
  build: ({ account, amount }, chainId) => {
    const code = {
      cmd: "free.goliath-faucet.set-account-limit",
      args: [account, amount],
    };

    const keyPairs: KeyPairCapabilities = {
      ...faucetAccount.keys,
      clist: [
        { name: "free.goliath-faucet.SET_LIMIT", args: [] },
        { name: "coin.GAS", args: [] },
      ],
    };

    const meta: Pact.TransactionMetadata = {
      creationTime: creationTime(),
      gasPrice: GAS_PRICE,
      ttl: TTL,
      chainId: chainId ?? DEFAULT_CHAIN,
      gasLimit: 500,
      sender: faucetAccount.address,
    };

    return { networkId: NETWORK_ID, pactCode: formatPactCode(code), keyPairs, meta };
  },
});

// Finally, we'll implement bindings to the (return-funds) function from the
// faucet. This lets users send funds back to the faucet, crediting against
// their account limits.

export type ReturnFundsArgs = {
  account: string;
  // Since the user needs to sign the transaction to transfer funds back to the
  // faucet, we need access to their signature. In our application we have their
  // keys, but a more sophisticated application would connect with a third-party
  // wallet to sign.
  accountKeys: KeyPair;
  amount: PactDecimal;
};

// Return funds from the user account to the faucet, crediting against their
// account limits. See also:
// 01-faucet-contract/yaml/send/return-funds.yaml
export const returnFunds: PactRequest<ReturnFundsArgs, string> = buildRequest(HOST_NAME, {
  type: "send",
  parse: (response) => response as string,
  build: ({ account, accountKeys, amount }, chainId) => {
    const code = {
      cmd: "free.goliath-faucet.return-funds",
      args: [account, amount],
    };

    // This is our only transaction that uses multiple signers. The user must sign
    // the transaction to authorize transferring their funds, and the faucet must
    // sign the transaction to authorize paying for gas.
    const keyPairs = [
      {
        ...accountKeys,
        clist: [{ name: "coin.TRANSFER", args: [account, amount, FAUCET_ACCOUNT] }],
      },
      {
        ...faucetAccount.keys,
        clist: [{ name: "coin.GAS", args: [] }],
      },
    ];

    const meta: Pact.TransactionMetadata = {
      creationTime: creationTime(),
      gasPrice: GAS_PRICE,
      ttl: TTL,
      chainId: chainId ?? DEFAULT_CHAIN,
      gasLimit: 2500,
      sender: faucetAccount.address,
    };

    return { networkId: NETWORK_ID, pactCode: formatPactCode(code), keyPairs, meta };
  },
});
