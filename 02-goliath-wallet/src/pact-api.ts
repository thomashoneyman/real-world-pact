/* PACT API CONFIGURATION

This file contains some constants to configure our use of the Pact API via the
pact-api-utils library written as part of this project.

To switch our application from running in "development" mode to running in
"production" mode is as simple as switching the Chainweb hostname and network we
are targeting!

*/

import { NetworkId } from "pact-lang-api";
import { HostName, PactAPI } from "@real-world-pact/utils/pact-request";
import {
  makeUsePactRequest,
  makeUsePactRequestAllChains,
} from "@real-world-pact/utils/pact-request-hooks";

// The network identifier is used to determine which network you intend your
// transaction to be a part of: the "mainnet" network (production), the "testnet"
// network (a test network maintained by Kadena), or the "development" network (our
// local devnet instance). The hostname is used to route requests to the Chainweb
// node we want to reach.
const networkId: NetworkId = "development";

// The location of the Chainweb node we're targeting. In our case this is the
// host where devnet is running, but for production this would be the server
// where you are hosting a Chainweb node.
const hostname: HostName = "localhost:8080";

// We deploy the faucet to Chain 0, so by default our requests will go to this
// chain.
const chainId: string = "0";

// This new 'pactAPI' is configured with our defaults and can be used to execute
// 'local' (read-only) and 'send' (modifies the blockchain) requests.
export const pactAPI = new PactAPI({ networkId, hostname, chainId });

// Use this hook to send a request and track its status in state
export const usePactRequest = makeUsePactRequest(pactAPI);

// Use this hook to send a request on all 20 chains and track their statuses.
export const usePactRequestAllChains = makeUsePactRequestAllChains(pactAPI);
