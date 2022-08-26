/* This file exports helper functions for creating requests to Chainweb. These
utilities are used to implement interfaces for Pact contracts or to construct
requests with arbitrary Pact code to send off.
*/

import * as Pact from "pact-lang-api";

export const NETWORK_ID = "development";

export const apiHost = (chainId: string): string =>
  `http://localhost:8080/chainweb/0.0/${NETWORK_ID}/chain/${chainId}/pact`;

// There are sensible defaults for some fields in our transaction metadata,
// namely how we calculate the transaction creation time, maximum time-to-live,
// and maximum gas price.
export const mkMeta = ({
  gasLimit,
  chainId,
  sender,
}: {
  gasLimit: number;
  chainId: string;
  sender: string;
}): Pact.TransactionMetadata => {
  return {
    creationTime: Math.round(new Date().getTime() / 1000) - 15,
    ttl: 28800,
    gasPrice: 0.00001,
    gasLimit,
    chainId,
    sender,
  };
};
