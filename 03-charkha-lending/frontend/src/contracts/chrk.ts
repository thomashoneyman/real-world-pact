/*
This module supplies requests for the 'free.CHRK' Pact module.
*/

import { LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
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
