/*
This module supplies requests for the 'free.CHRK' Pact module.
*/

import { LocalRequest, PactAPI, SendRequest } from "@real-world-pact/utils/pact-request";
import { KeyPair, KeySet } from "pact-lang-api";
import { charkhaKeyPair, sender02Address, sender02KeyPair } from "../constants";

export const init = (ref: string): SendRequest<string> => ({
  code: {
    cmd: "free.CHRK.init",
    args: [{ ref }],
  },
  sender: sender02Address,
  gasLimit: 750,
  signers: [
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.CHRK.ADMIN", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});

export const isInitialized = (): LocalRequest<boolean> => ({
  code: { cmd: "free.CHRK.is-initialized", args: [] },
  transformResponse: (response) => response as boolean,
});

interface ClaimCreateArgs {
  account: string;
  accountKeys: KeyPair;
  accountGuard: KeySet;
}

// In this function we will both accrue and claim, for convenience.
export const claimCreate = (args: ClaimCreateArgs): SendRequest<string> => ({
  code: [
    {
      cmd: "free.CHRK.accrue",
      args: [],
    },
    {
      cmd: "free.CHRK.claim-create",
      args: [args.account, { cmd: "read-keyset", args: ["user-keyset"] }],
    },
  ],
  data: { "user-keyset": args.accountGuard },
  sender: args.account,
  gasLimit: 10000,
  signers: [
    {
      ...args.accountKeys,
      clist: [{ name: "coin.GAS", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});
