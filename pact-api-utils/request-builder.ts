/* PACT API REQUEST BUILDER

The pact-lang-api library provides helper functions for sending an ExecCmd for
evaluation on a Chainweb node. The functions provided by the library are
primitive, so this file implements some helpers that make it easier make a
request and track its result — whether it's pending, has failed, or has returned
a success result.

We implement a "builder" pattern that separates creating a request from actually
sending it and parsing the result into a usable type for our UI. In short, the
"builder" is a function that, given an argument, produces an ExecCmd suitable to
be sent to Chainweb. Every request that we implement from a Pact contract file
will be written as a request builder. It looks like this:

const requestBuilder = {
  type: "local"
  parse: (data) => ...return parsed success data
  build: (input, chainId?) => ...return an ExecCmd
}

Then, you can run the request builder to get some functions you can use to
execute the request given the correct input. If you're curious to see how these
work in practice, please see the 'contracts' directory.

Goliath and Charkha both build on top of this helper library, but it's not tied
to either project and feel free to copy this code into your own projects.
*/

import * as Pact from "pact-lang-api";

/* 1. CONFIGURATION

We'll start with some minimal configuration for the pact-lang-api.

*/

// The hostname is the location of the Chainweb node. We always run a devnet
// node from localhost:8080, but we could host a Chainweb node elsewhere.
export type HostName = string;

// Constructs the full URL for the Pact endpoint on the given chain.
//
// * HOST is the address of the Chainweb node you are contacting
// * NETWORK_ID is the identifier for the network you are using. It is one of
//   "mainnet" (for production), "testnet" (a test network operated by Kadena),
//   or "development" (used for a local Chainweb node running devnet).
// * CHAIN_ID is the chain you wish to evaluate your Pact code on; there are
//   currently 20 chains, beginning with the id "0".
const apiHost = (host: HostName, networkId: Pact.NetworkId, chainId: string): string =>
  `http://${host}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;

/* 2. REQUEST STATUS TYPES

The Pact API on a Chainweb node exposes two endpoints for executing Pact code:

* /local is for non-transactional execution, ie. for Pact code that does not
  need to be mined into a block and can be run on a single node. It corresponds
  with the "local" requests in the 01-faucet-contract project.
  https://api.chainweb.com/openapi/pact.html#tag/endpoint-local

* /send is for transactional execution, ie. for Pact code that changes the state
  of the blockchain and must be mined into a block. It corresponds with the
  "send" requests from project 1.
  https://api.chainweb.com/openapi/pact.html#tag/endpoint-send

Let's capture the possible responses from the node when we send a /local or a
/send request. There are a few possible states:

* Pending: The request has been formatted and sent, but we have not received a
  response yet. We'll use this status to render a spinner in the UI.

* Request Error: Request errors indicate an issue with the formatted request
  reaching the Pact API. They occur when we can't connect to the node (ie. we
  forgot to start devnet), or the request was badly formatted, or the Pact code
  has syntax errors or calls a function that does not exist. For example, we
  will receive a request error if we try to call the faucet without deploying it
  to devnet first. We receive a simple string as our error.

* Exec Error: Execution errors indicate that our Pact code ran, but failed. For
  example, we may have forgotten to sign for a capability, or we may have failed
  an (enforce) check in the contract we called. Execution errors provide a more
  structured response including an error message and source span.

* Success: A success result indicates that our Pact code ran and returned a
  result to us. We can parse the result as JSON and use it.

One more thing: for convenience, we'll track the input argument used to build
the request as part of its status, as this is often useful in the UI.
*/

export type Status = "PENDING" | "REQUEST_ERROR" | "EXEC_ERROR" | "SUCCESS";

export const PENDING = "PENDING";
export const REQUEST_ERROR = "REQUEST_ERROR";
export const EXEC_ERROR = "EXEC_ERROR";
export const SUCCESS = "SUCCESS";

// A transaction is pending when we have sent it to a Chainweb node but haven't
// yet received a response.
export interface Pending<input> {
  input: input;
  request: Pact.ExecCmd;
  status: "PENDING";
}

// A request may fail if we are unable to reach a Chainweb node, in which case
// we will receive an error string that allows us to diagnose the error.
export interface RequestError<input> {
  input: input;
  request: Pact.ExecCmd;
  status: "REQUEST_ERROR";
  message: string;
}

// A request may fail if the Pact code in the transaction is no good — for
// example, if we didn't sign a required capability. A failed transaction still
// consumes gas and produces metadata, so we can provide details in the case
// of transaction failure.
export interface ExecError<input> {
  input: input;
  request: Pact.ExecCmd;
  status: "EXEC_ERROR";
  response: Pact.FailedLocalResponse | Pact.FailedExecResponse;
}

// If a request succeeds, then we store the response so that we can parse the
// result later for display in the UI.
export interface Success<input, result> {
  input: input;
  request: Pact.ExecCmd;
  status: "SUCCESS";
  response: Pact.SuccessLocalResponse | Pact.SuccessExecResponse;
  parsed: result;
}

// The possible results of sending a request for execution
export type RequestResult<input, result> =
  | RequestError<input>
  | ExecError<input>
  | Success<input, result>;

// The possible statuses of sending a request for execution
export type RequestStatus<input, result> = Pending<input> | RequestResult<input, result>;

/* 3.  EXECUTING REQUESTS

Alright! We've created types to capture the Pact code we will send to our
Chainweb node for executaion and the possible results of that request. Now it's
time to implement the requests themselves.

We will implement a function for /local requests and another for /send requests.
These requests will use the pact-lang-api to make the request, and then will
parse the result into the appropriate request status. In the case of a /send
request we will have to wait for the transaction to be mined, so we'll poll
every few seconds until the transaction completes.

*/

// We'll start with the /local endpoint:
// https://api.chainweb.com/openapi/pact.html#tag/endpoint-local
//
// When we send Pact code in a local request it will be executed on the node
// and the result of evaluation will be returned. For example, if we use
// (get-limits) from the goliath-faucet contract we will receive an object of
// our account limits in return.
//
// The pact-lang-api library provides a `local` function that takes an ExecCmd and
// the URL of the Pact endpoint to hit and makes an HTTP request on our behalf.
//
// Our request function is a wrapper around Pact.fetch.local that accepts a
// PactRequest as input, formats it (including setting the creation time),
// makes the request with `local`, and then parses the result.

// Make a request to the /local endpoint. This is an internal function, used to
// implement PactRequest.
const pactLocalRequest = async <a, b>(
  input: a,
  request: Pact.ExecCmd,
  parseResult: (value: Pact.PactValue) => b,
  hostname: HostName
): Promise<RequestResult<a, b>> => {
  try {
    const response = await Pact.fetch.local(
      request,
      apiHost(hostname, request.networkId, request.meta.chainId)
    );
    // If we receive a raw string as our result that indicates a request error.
    // The returned string is the error message.
    if (typeof response === "string") {
      return { input, request, status: REQUEST_ERROR, message: response };
    }
    // Otherwise, we received a response object.
    switch (response.result.status) {
      case "failure":
        const failure = response as Pact.FailedLocalResponse;
        return { input, request, status: EXEC_ERROR, response: failure };
      case "success":
        const success = response as Pact.SuccessLocalResponse;
        const parsed = parseResult(success.result.data);
        return { input, request, status: SUCCESS, response: success, parsed };
      default:
        const message = "Did not receive 'success' or 'failure' status.";
        return { input, request, status: REQUEST_ERROR, message };
    }
  } catch (err) {
    return { input, request, status: REQUEST_ERROR, message: `${err}` };
  }
};

// Next, we'll implement requests to the /send endpoint:
// https://api.chainweb.com/openapi/pact.html#tag/endpoint-send
//
// When we send Pact code to the /send endpoint it will be executed on the node
// and the transaction will be mined into a block and synced with other nodes.
// These requests take some time (usually 30 to 90 seconds) to complete, so the
// endpoint doesn't return a result right away. Instead, it returns a request
// ID you can use to look up the transaction status later.
//
// There are two endpoints to look up the transaction status: /poll and /listen.
//
// The /poll endpoint is non-blocking. We ask for the transaction result, and if
// it is still processing then we get an empty response. We should wait a few
// seconds and then ask again. This is the preferred way to look up a
// transaction status, because it lets us do other useful work while we wait.
// https://api.chainweb.com/openapi/pact.html#tag/endpoint-poll
//
// The /listen endpoint is blocking. We ask for the transaction result, and if
// the transaction is still processing then the connection is held open until it
// completes and the result is returned.
// https://api.chainweb.com/openapi/pact.html#tag/endpoint-poll

// Send a request ot the /send endpoint and then poll using the returned
// request key until the transaction completes. This is an internal function,
// used to implement PactRequest.
const pactSendRequest = async <a, b>(
  input: a,
  request: Pact.ExecCmd,
  parseResult: (value: Pact.PactValue) => b,
  hostname: HostName
): Promise<RequestResult<a, b>> => {
  try {
    const sendResponse = await Pact.fetch.send(
      request,
      apiHost(hostname, request.networkId, request.meta.chainId)
    );
    // The 'send' endpoint returns a request key we can use to poll for results.
    if (typeof sendResponse === "string") {
      // If we received a string back, that means the request failed.
      return { input, request, status: REQUEST_ERROR, message: sendResponse };
    } else if (!sendResponse.requestKeys[0]) {
      // If there are no request keys then this is an unexpected failure in the
      // Chainweb node.
      const message = "No request key received from Chainweb node.";
      return { input, request, status: REQUEST_ERROR, message };
    }

    // If we *did* receive a request key in response, then we can use it to poll
    // the Chainweb node until we receive a result.
    const requestKey = sendResponse.requestKeys[0];
    while (true) {
      const pollCmd: Pact.PollCmd = { requestKeys: [requestKey] };
      const pollResponse = await Pact.fetch.poll(
        pollCmd,
        apiHost(hostname, request.networkId, request.meta.chainId)
      );
      if (typeof pollResponse === "string") {
        // As before, if we received a string back, that means the request failed.
        return { input, request, status: REQUEST_ERROR, message: pollResponse };
      } else if (Object.keys(pollResponse).length === 0) {
        // If the poll endpoint returns an empty object, that means there is not
        // yet a result. We should pause, then poll again for results.
        await (async () => new Promise((resolve) => setTimeout(resolve, 3_000)))();
        continue;
      } else if (!pollResponse[requestKey]) {
        // If we received an object from the poll endpoint, then our transaction
        // data is located under the request key we used to poll. If that key
        // doesn't exist, this is an unexpected failure from the Chainweb node.
        const message = "Request key used to poll not present in poll response.";
        return { input, request, status: REQUEST_ERROR, message };
      }

      // If we *did* receive an response with the appropriate key, that means our
      // transaction was processed! We can now determine whether the transaction
      // succeeded. Transaction results are stored under the 'result' key. The
      // 'status' key within the result tells us the fate of our transaction.
      const response = pollResponse[requestKey];
      switch (response.result.status) {
        case "failure":
          const failure = response as Pact.FailedExecResponse;
          return { input, request, status: EXEC_ERROR, response: failure };

        case "success":
          const success = response as Pact.SuccessExecResponse;
          const parsed = parseResult(success.result.data);
          return { input, request, status: SUCCESS, response: success, parsed };

        default:
          // And, of course, if we received an unexpected status then once again
          // this is an unexpected error.
          const message = "Did not receive 'failure' or 'success' result status.";
          return { input, request, status: REQUEST_ERROR, message };
      }
    }
  } catch (err) {
    return { input, request, status: REQUEST_ERROR, message: `${err}` };
  }
};

/* 4. Request Builder

Finally, let's implement the request builder. We have a few goals:

1. We need to separate the definition of a request from its execution, because
   some of the fields in the request will become stale (for example, the
   creation time).

2. We want to make requests configurable (ie. they will change depending on what
   arguments you provide), but not make you write an entire request from scratch
   if you just need to tweak one field.

3. We want to parse the result of the Pact execution back into a TypeScript
   type. For example, a call to (free.goliath-faucet.get-limits) should return
   a structured object, not the raw JSON string we actually receive. This way
   we can work with the result in our UI.

The request builder lets us build a request from some inputs and specify how to
parse the result.

*/

// A type that separates the creation of a request from its execution. This type
// can be used to define how to create and parse a request, while the actual
// execution is deferred until the moment it is needed.
export interface RequestBuilder<input, result> {
  type: "local" | "send";
  build: (input: input, chainId?: string) => Pact.ExecCmd;
  parse: (result: Pact.PactValue) => result;
}

// A built request. Provides two functions for executing a request; the first
// sends the request and returns th result, while the second accepts a callback
// and will notify the callback of any change in the request status during
// execution.
export interface PactRequest<input, result> {
  run: (input: input, chainId?: string) => Promise<RequestResult<input, result>>;
  runWithCallback: (
    input: input,
    callback: (status: RequestStatus<input, result>) => any,
    chainId?: string
  ) => Promise<void>;
}

// Transform a RequestBuilder into a PactRequest targeting the provided hostname
// (ie. "localhost:8080" for development, or the domain of a Chainweb node).
export const buildRequest = <a, b>(
  hostname: HostName,
  builder: RequestBuilder<a, b>
): PactRequest<a, b> => {
  // When 'run' is called, we finally execute the request. First we build the
  // request so that fields like 'creationTime' are fresh, and then we execute
  // the relevant Pact request function and return.
  const run = async (input: a, chainId?: string) => {
    const request = builder.build(input, chainId);
    switch (builder.type) {
      case "local":
        return pactLocalRequest(input, request, builder.parse, hostname);
      default:
        return pactSendRequest(input, request, builder.parse, hostname);
    }
  };

  const runWithCallback = async (
    input: a,
    callback: (status: RequestStatus<a, b>) => any,
    chainId?: string
  ) => {
    const request = builder.build(input, chainId);
    callback({ input, status: PENDING, request });
    const result = await (() => {
      switch (builder.type) {
        case "local":
          return pactLocalRequest(input, request, builder.parse, hostname);
        default:
          return pactSendRequest(input, request, builder.parse, hostname);
      }
    })();
    switch (result.status) {
      case SUCCESS:
        callback({ ...result, parsed: builder.parse(result.response.result.data) });
        break;
      default:
        callback(result);
        break;
    }
  };
  return { run, runWithCallback };
};
