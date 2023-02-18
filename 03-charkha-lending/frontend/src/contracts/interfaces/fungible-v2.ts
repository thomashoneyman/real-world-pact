/*

This file implements functions and types for the 'fungible-v2' fungible token
interface, which all KIP-0005 compliant tokens must implement. Accordingly,
these bindings are usable with any fungible-v2-based contract.

*/

import Pact from "pact-lang-api";
import {
  coercePactNumber,
  coercePactObject,
  coercePactValue,
  LocalRequest,
} from "@real-world-pact/utils/pact-request";

// The (account-details) schema
export interface AccountDetails {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

export const details = (module: string, account: string): LocalRequest<AccountDetails> => ({
  code: { cmd: `${module}.details`, args: [account] },
  transformResponse: (response) => {
    const object = coercePactObject(response);
    return {
      account: object["account"] as string,
      balance: coercePactNumber(object["balance"]),
      guard: coercePactValue(object["guard"]),
    };
  },
});

export const getBalance = (module: string, account: string): LocalRequest<number> => ({
  code: { cmd: `${module}.get-balance`, args: [account] },
  transformResponse: coercePactNumber,
});
