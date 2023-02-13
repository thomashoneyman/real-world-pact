/*

This file implements functions and types for the 'market-interface' interface
for market tokens such as cwKDA, cwKETH, and cwCHRK.

It only includes types and functions that we actually use, rather than the
entire module.

*/

import Pact from "pact-lang-api";
import { coercePactValue, LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
import { MarketToken } from "../controller";
import { formatPactNumericResponse } from "@real-world-pact/utils/pact-code";

// The address to look up details about.
export interface Participant {
  "last-updated": number;
  "last-rate-index": number;
  balance: number;
  borrows: number;
  // Technically, there are more guard types than a keyset, but it's the only
  // one we use in our contract code.
  guard: Pact.KeySet;
}

export interface GetParticipantArgs {
  market: MarketToken;
  account: string;
}

export const getParticipant = (args: GetParticipantArgs): LocalRequest<Participant> => ({
  code: { cmd: `free.${args.market}.get-participant`, args: [args.account] },
  transformResponse: coercePactValue,
});

export const getBorrow = (args: GetParticipantArgs): LocalRequest<number> => ({
  code: { cmd: `free.${args.market}.get-borrow`, args: [args.account] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const getSupply = (args: GetParticipantArgs): LocalRequest<number> => ({
  code: { cmd: `free.${args.market}.get-supply`, args: [args.account] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});
