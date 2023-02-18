import { NetworkId } from "pact-lang-api";
import { HostName, PactAPI } from "@real-world-pact/utils/pact-request";
import { makeUsePactRequest } from "@real-world-pact/utils/pact-request-hooks";

const networkId: NetworkId = "development";
const hostname: HostName = "localhost:8080";
const chainId: string = "0";

// This new 'pactAPI' is configured with our defaults and can be used to execute
// 'local' (read-only) and 'send' (modifies the blockchain) requests.
export const pactAPI = new PactAPI({ networkId, hostname, chainId });
export const usePactRequest = makeUsePactRequest(pactAPI);
