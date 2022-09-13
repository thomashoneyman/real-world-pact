/*

This file implements several Hooks for managing requests to a Chainweb node
(both 'local' requests and transactions sent to the 'send' endpoint). Each Hook
takes as input a function that produces a valid PactSendRequest or
PactLocalRequest and returns two things:

1. A piece of state tracking the request status of the given request
2. The input function, which has been wrapped so that calling it executes the
   request and automatically updates the state at the same time.

Each Hook is typed with the argument used to build the request and the type of
a successful result from executing the request. This lets us easily work with
the parsed data in the UI.

Whenever you need to execute the request you've provided, you can call the
wrapped function. It will automatically track the state for you, which you can
then reference in your UI.

As a brief example, here's how to track the status of a (coin.details) request:

```ts
type DetailsArgs = string;

interface DetailsResult {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

const detailsRequest: PactRequest<DetailsArgs, DetailsResult> {
  type: "local",
  parse: (data) => data as string;
  build: (address: DetailsArgs, chainId: string = "0"): => {
    return {
      networkId: NETWORK_ID,
      pactCode: { cmd: "coin.details", args: [address] } ,
      meta: { chainId, ... } // these are omitted for brevity
    };
  };
};

const App = () => {
  // Using the useRequest Hook we now get access to the status of the request in
  // state and a function that will execute the request when given its input.
  const [detailsStatus, runDetails] = useRequest(detailsRequest);

  // We can now easily use both the state and the request in our UI.
  return (
    <div>{detailsStatus}</div>
    <button onClick={() => runDetails("goliath-faucet")}>Faucet Balance</button>
  );
}
```
*/

import { useState } from "react";
import { PactRequest, PENDING, RequestStatus } from "./request-builder";

// A Pact request that has been linked to a React state cell that tracks the
// status of the request(s).
export type RequestFn<input, result> = (
  input: input,
  onStatusChange?: (newStatus: RequestStatus<input, result>) => void,
  chainId?: string
) => Promise<void>;

// A Hook that returns a request status and a function to execute the request,
// given its input. When executed, the request status will be tracked in state.
export const useRequest = <input, result>(
  request: PactRequest<input, result>
): [null | RequestStatus<input, result>, RequestFn<input, result>] => {
  const [status, setStatus] = useState<null | RequestStatus<input, result>>(null);

  const runRequest: RequestFn<input, result> = (input, onStatusChange, chainId) => {
    const handleStatusChange = (status: RequestStatus<input, result>) => {
      setStatus(status);
      onStatusChange && onStatusChange(status);
    };
    return request.runWithCallback(input, handleStatusChange, chainId);
  };

  return [status, runRequest];
};

// A Hook that returns an array of request statuses, one for every time the
// request was executed, and a function to execute the request given its input.
// Requests are sorted with the most recent first.
export const useRequestGroup = <input, result>(
  request: PactRequest<input, result>
): [RequestStatus<input, result>[], RequestFn<input, result>] => {
  const [statuses, setStatuses] = useState<RequestStatus<input, result>[]>([]);

  const runRequest: RequestFn<input, result> = (input, onStatusChange, chainId) => {
    // Local requests return quickly, but transactions take a while to be mined.
    // It's possible that several transactions are initiated before the prior
    // transactions complete, so we need to track the position of a particular
    // request in the closure.
    let id: number;

    const handleStatusChange = (newStatus: RequestStatus<input, result>) => {
      switch (newStatus.status) {
        // When we receive a PENDING status, that means the request has been
        // initiated and we should insert it at the beginning of the array.
        case PENDING:
          setStatuses((oldStatuses) => {
            const copy = Array.from(oldStatuses);
            id = copy.length;
            copy.push(newStatus);
            return copy;
          });
          onStatusChange && onStatusChange(newStatus);
          break;

        // Otherwise, we've received a non-pending status and we should update the
        // array at the index we previously stored.
        default:
          setStatuses((oldStatuses) => {
            const copy = Array.from(oldStatuses);
            copy[id] = newStatus;
            return copy;
          });
          onStatusChange && onStatusChange(newStatus);
          break;
      }
    };

    return request.runWithCallback(input, handleStatusChange, chainId);
  };

  return [Array.from(statuses).reverse(), runRequest];
};

// A Hook that will execute the given request on all chains and store the 20
// request statuses in an array in state. The array is initialized empty, so
// indexing into it will return null if the request has not been sent.
export const useRequestAllChains = <input, result>(
  request: PactRequest<input, result>
): [RequestStatus<input, result>[], (input: input) => Promise<void>] => {
  const [statuses, setStatuses] = useState<RequestStatus<input, result>[]>([]);

  const handleStatusChange = (newStatus: RequestStatus<input, result>, index: number) => {
    setStatuses((oldStatuses) => {
      const copy = Array.from(oldStatuses);
      copy[index] = newStatus;
      return copy;
    });
  };

  const runRequest = async (input: input) => {
    await Promise.all(
      Array.from({ length: 20 }, async (_, index) =>
        request.runWithCallback(
          input,
          (status) => handleStatusChange(status, index),
          index.toString()
        )
      )
    );
  };

  return [statuses, runRequest];
};
