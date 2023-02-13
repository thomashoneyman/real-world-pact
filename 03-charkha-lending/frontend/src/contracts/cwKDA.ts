/*
This module supplies requests for the 'free.cwKDA' Pact module.
*/

import { LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
import { charkhaKeyPair, sender02Address, sender02KeyPair } from "../constants";

export const init = (ref: string): SendRequest<string> => ({
  code: {
    cmd: "free.cwKDA.init",
    args: [{ ref }],
  },
  sender: sender02Address,
  gasLimit: 500,
  signers: [
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.cwKDA.ADMIN", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});

export const isInitialized = (): LocalRequest<boolean> => ({
  code: { cmd: "free.cwKDA.is-initialized", args: [] },
  transformResponse: (response) => response as boolean,
});
