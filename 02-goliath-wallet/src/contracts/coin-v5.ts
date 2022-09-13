/*

This file implements functions and types for the 'coin-v5' fundamental contract
deployed by Kadena onto Chainweb. The coin contract provides an API for creating
accounts and transferring funds.

This file only includes functions and types from the coin module that we need
for our project, and isn't a full reproduction of the contract.

Contract source:
https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v5/coin-v5.pact

*/

import Pact from "pact-lang-api";
import { HOST_NAME } from "../config";
import { buildRequest, PactRequest } from "../pact-utils/request-builder";
import { defaultLocalCmd, coercePactValue } from "./utils";

// The address to look up details about.
export type DetailsArgs = {
  address: string;
};

// The type of a successful call to the (coin.details) function.
export interface DetailsResponse {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

// Look up the details for the given address using (coin.details)
// https://github.com/kadena-io/chainweb-node/blob/56e99ae421d2269a657e3bb3780c6d707e5149a0/pact/coin-contract/v5/coin-v5.pact#L304
export const details: PactRequest<DetailsArgs, DetailsResponse> = buildRequest(HOST_NAME, {
  type: "local",
  parse: (response) => coercePactValue(response),
  build: ({ address }, chainId): Pact.ExecCmd => {
    const code = { cmd: "coin.details", args: [address] };
    return defaultLocalCmd(code, undefined, chainId);
  },
});
