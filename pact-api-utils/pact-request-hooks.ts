/*

This file implements several hooks for managing requests to a Chainweb node. Each
hook should be configured with your PactAPI setup:

```ts
const pactAPI = new PactAPI(...) // your configuration
const useRequest = makeUsePactRequest(pactAPI);
```

Each of these hooks takes a function ((args: a) => PactRequest<b>), which is a
function from some input data to a request that can be sent to a Chainweb node.
In return, each hook gives you:

1. A piece of state tracking the request status(es) of your given request.
2. A function for making a new request, given the arguments the request needs.

As a brief example, here's how to track the status of a (coin.details) request:

```ts
type DetailsArgs = string;

interface DetailsResult {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

const detailsRequest = (address: DetailsArgs): LocalRequest<DetailsResult> => ({
  code: { cmd: "coin.details", args: [address] },
  transformResponse: coercePactValue
});

const pactAPI = new PactAPI();
const useRequest = makeUsePactRequest(pactAPI);

const App = () => {
  // Using the usePactRequest hook we now get access to the status of the request
  // in state and a function to execute the request when given its input.
  const [details, fetchDetails] = useRequest(detailsRequest);

  // We can now easily use both the state and the request in our UI.
  return (
    <div>{details}</div>
    <button onClick={() => fetchDetails("goliath-faucet")}>Faucet Balance</button>
  );
}
```
*/

import { useEffect, useState } from "react";
import {
  isSendRequest,
  PactAPI,
  PactAPIConfig,
  PactRequest,
  Pending,
  PENDING,
  RequestResult,
  RequestStatus,
} from "./pact-request";

// A Hook that returns a request status and a function to send a new request.
export const makeUsePactRequest = (api: PactAPI) => {
  return <a, b>(
    mkRequest: (args: a) => PactRequest<b>,
    config?: Partial<PactAPIConfig>
  ): [null | RequestStatus<b>, (args: a) => Promise<RequestResult<b>>] => {
    const [status, setStatus] = useState<null | RequestStatus<b>>(null);

    const fetch = (args: a) => {
      const request = mkRequest(args);
      if (isSendRequest(request)) {
        return api.sendWithCallback(request, setStatus, config);
      } else {
        return api.localWithCallback(request, setStatus, config);
      }
    };

    return [status, fetch];
  };
};

// A Hook that immediately sends a request and returns its status and a function
// to send it again.
export const makeUseImmediatePactRequest = (api: PactAPI) => {
  return <a>(request: PactRequest<a>, config?: Partial<PactAPIConfig>): RequestStatus<a> => {
    const initialState = (): Pending => {
      if (isSendRequest(request)) {
        return {
          status: PENDING,
          request: api.format(request, request.sender, request.gasLimit, config),
        };
      } else {
        return {
          status: PENDING,
          request: api.format(request, "", 150_000, config),
        };
      }
    };

    const [status, setStatus] = useState<RequestStatus<a>>(initialState());

    useEffect(() => {
      const run = async () => {
        if (isSendRequest(request)) {
          await api.sendWithCallback(request, setStatus, config);
        } else {
          await api.localWithCallback(request, setStatus, config);
        }
      };
      run();
    }, []);

    return status;
  };
};

export type UsePactRequestAllChainsResult<a> = [RequestStatus<a>[], () => void];

// A Hook that will execute the given request on all chains and store the 20
// request statuses in an array in state. The array is initialized empty, so
// indexing into it will return null if the request has not been sent.
export const makeUsePactRequestAllChains = (api: PactAPI) => {
  return <a, b>(
    mkRequest: (args: a) => PactRequest<b>,
    config?: Partial<PactAPIConfig>
  ): [RequestStatus<b>[], (args: a) => Promise<void>] => {
    const [statuses, setStatuses] = useState<RequestStatus<b>[]>([]);

    const handleStatusChange = (newStatus: RequestStatus<b>, index: number) => {
      setStatuses((oldStatuses) => {
        const copy = Array.from(oldStatuses);
        copy[index] = newStatus;
        return copy;
      });
    };

    const fetch = async (args: a) => {
      const request = mkRequest(args);
      await Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
          if (isSendRequest(request)) {
            return api.sendWithCallback(request, (status) => handleStatusChange(status, index), {
              ...config,
              chainId: index.toString(),
            });
          } else {
            return api.localWithCallback(request, (status) => handleStatusChange(status, index), {
              ...config,
              chainId: index.toString(),
            });
          }
        })
      );
    };

    return [statuses, fetch];
  };
};
