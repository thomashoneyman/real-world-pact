/*

This file implements functions and types for the 'fungible-v2' fungible token
interface, which all KIP-0005 compliant tokens must implement. Accordingly,
these bindings are usable with any fungible-v2-based contract.

*/

import Pact from "pact-lang-api";
import { coercePactValue, LocalRequest } from "@real-world-pact/utils/pact-request";

// The (account-details) schema
export interface AccountDetails {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

export const details = (module: string, account: string): LocalRequest<AccountDetails> => ({
  code: { cmd: `${module}.details`, args: [account] },
  transformResponse: coercePactValue,
});

export const getBalance = (module: string, account: string): LocalRequest<number> => ({
  code: { cmd: `${module}.get-balance`, args: [account] },
  transformResponse: coercePactValue,
});
