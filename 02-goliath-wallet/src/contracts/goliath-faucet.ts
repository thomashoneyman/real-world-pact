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

import Pact, { KeyPair, PactDecimal } from "pact-lang-api";
import { faucetAccount } from "../accounts";
import { coercePactValue, LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";

// Corresponds with constants defined in the 'goliath-faucet smart contract.
export const FAUCET_ACCOUNT = "goliath-faucet";
export const DEFAULT_REQUEST_LIMIT = 20.0;
export const DEFAULT_ACCOUNT_LIMIT = 100.0;

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
// 01-faucet-contract/request/send/request-funds.yaml
export const requestFunds = (args: RequestFundsArgs): SendRequest<string> => ({
  // The account responsible for paying gas
  sender: faucetAccount.address,

  // The maximum amount of gas this transaction can consume before it is cancelled
  gasLimit: 2500,

  // The code to be executed on the Chainweb node
  code: {
    cmd: "free.goliath-faucet.request-funds",
    args: [args.targetAddress, { cmd: "read-keyset", args: ["target-keyset"] }, args.amount],
  },

  // The transaction data to include with the transaction
  data: { "target-keyset": args.targetAddressKeySet },

  // The keys that should be used to sign the transaction, along with the caps
  // to scope their signature to
  signers: {
    ...faucetAccount.keys,
    clist: [
      { name: "coin.TRANSFER", args: [FAUCET_ACCOUNT, args.targetAddress, args.amount] },
      { name: "coin.GAS", args: [] },
    ],
  },

  transformResponse: (response: Pact.PactValue) => response as string,
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
// 01-faucet-contract/request/local/user-limits.yaml
export const getLimits = (args: GetLimitsArgs): LocalRequest<GetLimitsResponse> => ({
  code: { cmd: "free.goliath-faucet.get-limits", args: [args.address] },
  transformResponse: coercePactValue,
});

// Next, we have the (set-request-limit) and (set-account-limit) functions.

export interface SetRequestLimitArgs {
  account: string;
  amount: Pact.PactDecimal;
}

// Set the per-request limit for an account. See also:
// 01-faucet-contract/request/send/set-user-request-limit.yaml
export const setRequestLimit = (args: SetRequestLimitArgs): SendRequest<string> => ({
  sender: faucetAccount.address,
  gasLimit: 500,
  code: { cmd: "free.goliath-faucet.set-request-limit", args: [args.account, args.amount] },
  signers: {
    ...faucetAccount.keys,
    clist: [
      { name: "free.goliath-faucet.SET_LIMIT", args: [] },
      { name: "coin.GAS", args: [] },
    ],
  },
  transformResponse: (response: Pact.PactValue) => response as string,
});

export interface SetAccountLimitArgs {
  account: string;
  amount: Pact.PactDecimal;
}

// Set the per-account limit for an account. See also:
// 01-faucet-contract/request/send/set-user-account-limit.yaml
export const setAccountLimit = (args: SetAccountLimitArgs): SendRequest<string> => ({
  sender: faucetAccount.address,
  gasLimit: 500,
  code: { cmd: "free.goliath-faucet.set-account-limit", args: [args.account, args.amount] },
  signers: {
    ...faucetAccount.keys,
    clist: [
      { name: "free.goliath-faucet.SET_LIMIT", args: [] },
      { name: "coin.GAS", args: [] },
    ],
  },
  transformResponse: (response: Pact.PactValue) => response as string,
});

// Finally, we'll implement bindings to the (return-funds) function from the
// faucet. This lets users send funds back to the faucet, crediting against
// their account limits.

export interface ReturnFundsArgs {
  account: string;
  // Since the user needs to sign the transaction to transfer funds back to the
  // faucet, we need access to their signature. In our application we have their
  // keys, but a more sophisticated application would connect with a third-party
  // wallet to sign.
  accountKeys: KeyPair;
  amount: PactDecimal;
}

// Return funds from the user account to the faucet, crediting against their
// account limits. See also:
// 01-faucet-contract/request/send/return-funds.yaml
export const returnFunds = (args: ReturnFundsArgs): SendRequest<string> => ({
  sender: faucetAccount.address,
  gasLimit: 2500,
  code: { cmd: "free.goliath-faucet.return-funds", args: [args.account, args.amount] },
  // This is our only transaction that uses multiple signers. The user must sign
  // the transaction to authorize transferring their funds, and the faucet must
  // sign the transaction to authorize paying for gas.
  signers: [
    {
      ...args.accountKeys,
      clist: [{ name: "coin.TRANSFER", args: [args.account, FAUCET_ACCOUNT, args.amount] }],
    },
    {
      ...faucetAccount.keys,
      clist: [{ name: "coin.GAS", args: [] }],
    },
  ],
  transformResponse: (response: Pact.PactValue) => response as string,
});
