import * as Pact from "pact-lang-api";
import { DEFAULT_CHAIN, GAS_PRICE, NETWORK_ID, TTL } from "../config";
import { formatPactCode, PactCode } from "../pact-utils/pact-code";

// A helper function to generate a new creation time when building a
// new transaction.
export const creationTime = () => {
  return Math.round(new Date().getTime() / 1000 - 15);
};

// A helper function to coerce the result of a successful Pact execution into
// the specified type.
export const coercePactValue = <a>(data: Pact.PactValue): a => {
  return JSON.parse(JSON.stringify(data)) as a;
};

// A helper function to generate a Pact.ExecCmd for a local request from just
// the code and environment data (all other fields are defaulted).
export const defaultLocalCmd = (
  code: PactCode,
  envData?: { [key: string]: Pact.PactValue | Pact.KeySet },
  chainId?: string
): Pact.ExecCmd => {
  const pactCode = formatPactCode(code);
  const meta = {
    creationTime: creationTime(),
    gasPrice: GAS_PRICE,
    ttl: TTL,
    chainId: chainId ?? DEFAULT_CHAIN,
    // We don't pay for gas in local requests, so we can set it to a reasonably
    // high gas limit. The request will still fail if the gas limit is exceeded.
    gasLimit: 15_000,
    // There is no gas payer, ie. "sender", needed for a local request.
    sender: "",
  };
  return { networkId: NETWORK_ID, pactCode, envData, meta };
};
