/*

This file implements functions and types for the 'market-interface' interface
for market tokens such as cwKDA, cwKETH, and cwCHRK.

It only includes types and functions that we actually use, rather than the
entire module.

*/

import {
  coercePactNumber,
  coercePactObject,
  LocalRequest,
} from "@real-world-pact/utils/pact-request";
import { MarketToken } from "../controller";

// The address to look up details about.
export interface Participant {
  lastUpdated: number;
  lastRateIndex: number;
  balance: number;
  borrows: number;
}

export interface GetParticipantArgs {
  market: MarketToken;
  account: string;
}

export const getParticipant = (args: GetParticipantArgs): LocalRequest<Participant> => ({
  code: { cmd: `free.${args.market}.get-participant`, args: [args.account] },
  transformResponse: (response) => {
    const object = coercePactObject(response);
    return {
      lastUpdated: coercePactNumber(object["last-updated"]),
      lastRateIndex: coercePactNumber(object["last-rate-index"]),
      balance: coercePactNumber(object["balance"]),
      borrows: coercePactNumber(object["borrows"]),
    };
  },
});

export const getBorrow = (args: GetParticipantArgs): LocalRequest<number> => ({
  code: { cmd: `free.${args.market}.get-borrow`, args: [args.account] },
  transformResponse: coercePactNumber,
});

export const getSupply = (args: GetParticipantArgs): LocalRequest<number> => ({
  code: { cmd: `free.${args.market}.get-supply`, args: [args.account] },
  transformResponse: coercePactNumber,
});
