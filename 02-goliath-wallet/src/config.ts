/* CONFIGURATION

This file contains some constants to configure our application. Our app is small
so our config is, too. In our case we only store the network identifier and
hostname of the Chainweb node we're communicating with (in our case, devnet).

The network identifier is used to determine which network you intend your
transaction to be a part of: the "mainnet" network (production), the "testnet"
network (a test network maintained by Kadena), or the "development" network (our
local devnet instance). The hostname is used to route requests to the Chainweb
node we want to reach.

To switch our application from running in "development" mode to running in
"production" mode is as simple as switching the Chainweb node and network we
are targeting!

*/

import { NetworkId } from "pact-lang-api";
import { HostName } from "@real-world-pact/utils/request-builder";

// Which network to target. For production code targeting the main Kadena
// network, use "mainnet01".
export const NETWORK_ID: NetworkId = "development";

// The location of the Chainweb node we're targeting. In our case this is the
// host where devnet is running, but for production this would be the server
// where you are hosting a Chainweb node.
export const HOST_NAME: HostName = "localhost:8080";

// The maximum price we are willing to pay per unit of gas. To find the current
// gas prices on Chainweb, look at the recent transactions here:
// https://explorer.chainweb.com/mainnet/
export const GAS_PRICE = 0.0000001;

// This is a reasonable TTL for transactions. If the transaction is not
// processed in this number of seconds then it will be rejected on the node.
export const TTL = 28800;

// The faucet is deployed on Chain 0, so we'll set that as the default so we
// don't always have to provide it as an argument.
export const DEFAULT_CHAIN: string = "0";
