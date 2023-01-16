/* PACT API REQUEST BUILDER

The pact-lang-api library provides helper functions for sending an ExecCmd for
evaluation on a Chainweb node. The functions provided by the library are
primitive, so this file implements some helpers that make it easier make a
request and track its result — whether it's pending, has failed, or has returned
a success result.

This file provides two simple request types we can use to describe Pact code we
want to execute on a Chainweb node and PactAPI class to help you send those
requests with minimal bookkeeping.

Goliath and Charkha both build on top of this helper library, but it's not tied
to either project and feel free to copy this code into your own projects.
*/

import * as Pact from "pact-lang-api";
import { formatPactCode, PactCode } from "./pact-code";

/* 1. REQUEST TYPES

The Pact API on a Chainweb node exposes two endpoints for executing Pact code:

* /local is for non-transactional execution, ie. for Pact code that does not
  need to be mined into a block and can be run on a single node. It corresponds
  with the "local" requests in the 01-faucet-contract project.
  https://api.chainweb.com/openapi/pact.html#tag/endpoint-local

* /send is for transactional execution, ie. for Pact code that changes the state
  of the blockchain and must be mined into a block. It corresponds with the
  "send" requests from project 1.
  https://api.chainweb.com/openapi/pact.html#tag/endpoint-send

*/

// A local request is executed on the Chainweb node only and can only read data.
// It can't modify the state of the blockchain, so it does not get broadcast to
// other nodes, does not cost gas, and does not need a sender.
export interface LocalRequest<a> {
  // The code that should be executed on the Chainweb node
  code: PactCode;
  // Data that should be included on the transaction so Pact code can read it
  data?: { [key: string]: Pact.PactValue | Pact.KeySet };
  // Signers of the transaction along with any capabilities the signatures
  // should be scoped to.
  signers?: Pact.KeyPairCapabilities | Pact.KeyPairCapabilities[];
  transformResponse: (response: Pact.PactValue) => a;
}

// A 'send' request is executed on the Chainweb node and broadcast to other
// nodes. It modifies the state of the blockchain, costs gas, and requires a
// sender.
export interface SendRequest<a> {
  // The sender is the address responsible for paying the gas on the transaction
  sender: string;
  // The maximum amount of gas this request is allowed to take
  gasLimit: number;
  // The code that should be executed on the Chainweb node
  code: PactCode;
  // Data that should be included on the transaction so Pact code can read it
  data?: { [key: string]: Pact.PactValue | Pact.KeySet };
  // Signers of the transaction along with any capabilities the signatures
  // should be scoped to.
  signers: Pact.KeyPairCapabilities | Pact.KeyPairCapabilities[];
  transformResponse: (response: Pact.PactValue) => a;
}

// A helper function to coerce the result of a successful Pact execution into
// the specified type, which can be used for 'transformResponse' when you know the
// result can be mapped to JSON.
export const coercePactValue = <a>(data: Pact.PactValue): a => {
  return JSON.parse(JSON.stringify(data)) as a;
};

export type PactRequest<a> = LocalRequest<a> | SendRequest<a>;

export function isSendRequest<a>(req: PactRequest<a>): req is SendRequest<a> {
  return (req as SendRequest<a>).sender ? true : false;
}

export function isLocalRequest<a>(req: PactRequest<a>): req is LocalRequest<a> {
  return isSendRequest(req) ? false : true;
}

/* 2. REQUEST STATUS TYPES

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
  result to us. We can parse the result and use it.
*/

export type Status = "PENDING" | "REQUEST_ERROR" | "EXEC_ERROR" | "SUCCESS";

export const PENDING = "PENDING";
export const REQUEST_ERROR = "REQUEST_ERROR";
export const EXEC_ERROR = "EXEC_ERROR";
export const SUCCESS = "SUCCESS";

// A transaction is pending when we have sent it to a Chainweb node but haven't
// yet received a response.
export interface Pending {
  request: Pact.ExecCmd;
  status: "PENDING";
}

// A request may fail if we are unable to reach a Chainweb node, in which case
// we will receive an error string that allows us to diagnose the error.
export interface RequestError {
  request: Pact.ExecCmd;
  status: "REQUEST_ERROR";
  message: string;
}

// A request may fail if the Pact code in the transaction is no good — for
// example, if we didn't sign a required capability. A failed transaction still
// consumes gas and produces metadata, so we can provide details in the case
// of transaction failure.
export interface ExecError {
  request: Pact.ExecCmd;
  status: "EXEC_ERROR";
  response: Pact.FailedLocalResponse | Pact.FailedExecResponse;
}

// If a request succeeds, then we store the response so that we can parse the
// result later for display in the UI.
export interface Success<a> {
  request: Pact.ExecCmd;
  status: "SUCCESS";
  response: Pact.SuccessLocalResponse | Pact.SuccessExecResponse;
  parsed: a;
}

// The possible result of sending a request for execution
export type RequestResult<a> = RequestError | ExecError | Success<a>;

// The possible statuses of sending a request for execution
export type RequestStatus<a> = Pending | RequestResult<a>;

/* 3.  EXECUTING REQUESTS

Alright! We've created types to capture the Pact code we will send to our
Chainweb node for executaion and the possible results of that request. Now it's
time to implement the requests themselves.

We will implement a PactAPI class that can be configured once and then used
to send requests. This class provides four ways to make a request:

* local: execute a LocalRequest
* send: execute a SendRequest
* localWithCallback: execute a LocalRequest, getting notified of each status
    change on the request.
* sendWithCallback: execute a SendRequest, getting notified of each status
    change on the request.

Along the way we'll implement helper functions for formatting a Pact request. I
recommend you read through this class to see concretely how to send a request to
the Pact endpoint and interpret the possible responses.

*/

// The hostname is the location of the Chainweb node. We always run a devnet
// node from localhost:8080 in our local applications.
export type HostName = string;

// Common fields that are required when sending Pact code to the Pact API on a
// Chainweb node, but which have a sensible default value. Most of these fields
// should be familiar from the request files in Project 1. See also:
// https://pact-language.readthedocs.io/en/stable/pact-reference.html#request-yaml-file-format
export interface PactAPIConfig {
  // The location of the Chainweb node we're targeting. In our case this is the
  // host where devnet is running, but for production this would be the server
  // where you are hosting a Chainweb node.
  hostname: HostName;
  // Which network to target. For production code targeting the main Kadena
  // network, use "mainnet01". For devnet use "development."
  networkId: Pact.NetworkId;
  // Which chain the Pact code should be executed on. Should be the same chain
  // as where the target module has been deployed.
  chainId: string;
  // The maximum price we are willing to pay per unit of gas. To find the current
  // gas prices on Chainweb, look at the recent transactions here:
  // https://explorer.chainweb.com/mainnet/
  gasPrice: number;
  // The maximum number of seconds it can take for this transaction to be
  // processed. If it is not processed in time then it will be rejected by the
  // Chainweb node.
  ttl: number;
}

// Create a new instance of the PactAPI class, which helps you send Pact code
// for the local (read-only) and send (writable) endpoints of a Chainweb node.
export class PactAPI {
  constructor(config?: Partial<PactAPIConfig>) {
    // A set of reasonable defaults for use with the PactAPI class. These can be
    // overridden on a per-request basis.
    this.defaults = {
      // Our devnet node runs on localhost:8080
      hostname: config?.hostname || "localhost:8080",
      // We're typically targeting devnet, so we use the "development" network
      networkId: config?.networkId || "development",
      // We usually deploy to chain 0 for convenience.
      chainId: config?.chainId || "0",
      // This is a typical gas price.
      gasPrice: config?.gasPrice || 0.0000001,
      // We don't want our transactions to process if they get stuck for more than
      // 3 minutes, if for no other reason than that it will make our UI slow.
      ttl: config?.ttl || 300,
    };
  }

  // The default configuration for use in each request. Any value in the config
  // can be overridden by setting it as part of the request.
  defaults: PactAPIConfig;

  // Format the full API URL for the Pact endpoint on a Chainweb node
  private apiHost = (host: HostName, networkId: Pact.NetworkId, chainId: string): string =>
    `http://${host}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;

  // Set the creation time to right now (with a slight delay in case the node
  // and your local clocks are somewhat out of sync).
  private creationTime = () => {
    return Math.round(new Date().getTime() / 1000 - 15);
  };

  // Format a request into an ExecCmd suitable for use with pact-lang-api
  // functions.
  private format<a>(
    request: PactRequest<a>,
    sender: string,
    gasLimit: number,
    config?: Partial<PactAPIConfig>
  ): Pact.ExecCmd {
    const networkId = config?.networkId || this.defaults.networkId;
    const chainId = config?.chainId || this.defaults.chainId;
    return {
      networkId,
      pactCode: formatPactCode(request.code),
      envData: request.data,
      keyPairs: request.signers,
      meta: {
        chainId,
        sender,
        gasLimit,
        creationTime: this.creationTime(),
        gasPrice: config?.gasPrice || this.defaults.gasPrice,
        ttl: config?.ttl || this.defaults.ttl,
      },
    };
  }

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
  // LocalRequest as input, formats it (including setting the creation time),
  // makes the request with `local`, and then parses the result.
  async local<a>(
    request: LocalRequest<a>,
    config?: Partial<PactAPIConfig>
  ): Promise<RequestResult<a>> {
    const hostname = config?.hostname || this.defaults.hostname;
    // We set the sender to "" and the gas limit to the maximum because they
    // aren't needed for local requests.
    const cmd = this.format(request, "", 150_000, config);
    const endpoint = this.apiHost(hostname, cmd.networkId, cmd.meta.chainId);
    try {
      const response = await Pact.fetch.local(cmd, endpoint);
      // If we receive a raw string as our result that indicates a request error.
      // The returned string is the error message.
      if (typeof response === "string") {
        return { request: cmd, status: REQUEST_ERROR, message: response };
      }
      // Otherwise, we received a response object.
      switch (response.result.status) {
        case "failure":
          const failure = response as Pact.FailedLocalResponse;
          return { request: cmd, status: EXEC_ERROR, response: failure };
        case "success":
          const success = response as Pact.SuccessLocalResponse;
          const parsed = request.transformResponse(success.result.data);
          return { request: cmd, status: SUCCESS, response: success, parsed };
        default:
          const message = "Did not receive 'success' or 'failure' status.";
          return { request: cmd, status: REQUEST_ERROR, message };
      }
    } catch (err) {
      return { request: cmd, status: REQUEST_ERROR, message: `${err}` };
    }
  }

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
  async send<a>(
    request: SendRequest<a>,
    config?: Partial<PactAPIConfig>
  ): Promise<RequestResult<a>> {
    const hostname = config?.hostname || this.defaults.hostname;
    const cmd = this.format(request, request.sender, request.gasLimit, config);
    const endpoint = this.apiHost(hostname, cmd.networkId, cmd.meta.chainId);
    try {
      const sendResponse = await Pact.fetch.send(cmd, endpoint);

      // The 'send' endpoint returns a request key we can use to poll for results.
      if (typeof sendResponse === "string") {
        // If we received a string back, that means the request failed.
        return { request: cmd, status: REQUEST_ERROR, message: sendResponse };
      } else if (!sendResponse.requestKeys[0]) {
        // If there are no request keys then this is an unexpected failure in the
        // Chainweb node.
        const message = "No request key received from Chainweb node.";
        return { request: cmd, status: REQUEST_ERROR, message };
      }

      // If we *did* receive a request key in response, then we can use it to poll
      // the Chainweb node until we receive a result.
      const requestKey = sendResponse.requestKeys[0];
      while (true) {
        const pollCmd: Pact.PollCmd = { requestKeys: [requestKey] };
        const pollResponse = await Pact.fetch.poll(pollCmd, endpoint);
        if (typeof pollResponse === "string") {
          // As before, if we received a string back, that means the request failed.
          return { request: cmd, status: REQUEST_ERROR, message: pollResponse };
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
          return { request: cmd, status: REQUEST_ERROR, message };
        }

        // If we *did* receive an response with the appropriate key, that means our
        // transaction was processed! We can now determine whether the transaction
        // succeeded. Transaction results are stored under the 'result' key. The
        // 'status' key within the result tells us the fate of our transaction.
        const response = pollResponse[requestKey];
        switch (response.result.status) {
          case "failure":
            const failure = response as Pact.FailedExecResponse;
            return { request: cmd, status: EXEC_ERROR, response: failure };

          case "success":
            const success = response as Pact.SuccessExecResponse;
            const parsed = request.transformResponse(success.result.data);
            return { request: cmd, status: SUCCESS, response: success, parsed };

          default:
            // And, of course, if we received an unexpected status then once again
            // this is an unexpected error.
            const message = "Did not receive 'failure' or 'success' result status.";
            return { request: cmd, status: REQUEST_ERROR, message };
        }
      }
    } catch (err) {
      return { request: cmd, status: REQUEST_ERROR, message: `${err}` };
    }
  }

  // Execute a local request given a callback to be notified as the request
  // status changes.
  async localWithCallback<a>(
    request: LocalRequest<a>,
    callback: (status: RequestStatus<a>) => any,
    config?: Partial<PactAPIConfig>
  ): Promise<RequestResult<a>> {
    const cmd = this.format(request, "", 150_000, config);
    callback({ status: PENDING, request: cmd });
    const result = await this.local(request, config);
    callback(result);
    return result;
  }

  // Execute a send request given a callback to be notified as the request
  // status changes.
  async sendWithCallback<a>(
    request: SendRequest<a>,
    callback: (status: RequestStatus<a>) => any,
    config?: Partial<PactAPIConfig>
  ): Promise<RequestResult<a>> {
    const cmd = this.format(request, request.sender, request.gasLimit, config);
    callback({ status: PENDING, request: cmd });
    const result = await this.send(request, config);
    callback(result);
    return result;
  }
}
