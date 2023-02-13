/*
This module supplies requests for the 'free.KETH' Pact module.
*/

import Pact from "pact-lang-api";
import { SendRequest } from "@real-world-pact/utils/pact-request";
import { charkhaKeyPair } from "../constants";

export interface MintArgs {
  sender: string;
  senderKeys: Pact.KeyPair;
  receiver: string;
  receiverGuard: Pact.KeySet;
  amount: Pact.PactDecimal;
}

export const mint = (args: MintArgs): SendRequest<string> => ({
  code: {
    cmd: "free.KETH.mint",
    args: [args.receiver, { cmd: "read-keyset", args: ["receiver-guard"] }, args.amount],
  },
  data: { "receiver-guard": args.receiverGuard },
  sender: args.sender,
  gasLimit: 500,
  signers: [
    {
      ...args.senderKeys,
      clist: [{ name: "coin.GAS", args: [] }],
    },
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.KETH.MINT", args: [args.receiver, args.amount] }],
    },
  ],
  transformResponse: (response) => response as string,
});
