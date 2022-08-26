/* Validation failed for hash "heR_nXEPbMG2XPkyYUWvmGQkS8Y3c5hXxL0axclyIbQ": Attempt to buy gas failed with: (read coin-table sender): Failure: Tx Failed: read: row not found: goliath-faucet */

// In our UI we'd like to be able to track the status of a transaction from the
// time we send it until we receive a valid result. We'll do that by collecting
// information about our transactions into a few types.
import * as Pact from "pact-lang-api";
import React, { SetStateAction } from "react";
import { apiHost } from "./request-utils";

// These constants represent the codes we're using to track our transaction
// status. We can use these constants to case on the status of our transaction
// without risking a typo.
export const PENDING = "PENDING";
export const REQUEST_ERROR = "REQUEST_ERROR";
export const EXEC_ERROR = "EXEC_ERROR";
export const SUCCESS = "SUCCESS";

// A transaction is pending when we have sent it to a Chainweb node but haven't
// yet received a response.
interface TransactionPending<a> {
  args: a;
  type: "PENDING";
}

// A transaction may fail if we are unable to reach a Chainweb node, in which
// case we will receive an error string that allows us to diagnose the error.
interface TransactionRequestError<a, b> {
  args: a;
  cmd: Pact.ExecCmd<b>;
  type: "REQUEST_ERROR";
  message: string;
}

// A transaction may fail if the Pact code in the transaction is no good — for
// example, if we didn't sign a required capability. A failed transaction still
// consumes gas and produces metadata, so we can provide details in the case
// of transaction failure.
interface TransactionExecError<a, b> {
  args: a;
  cmd: Pact.ExecCmd<b>;
  type: "EXEC_ERROR";
  result: Pact.FailedExecTransactionResponse;
}

// When a transaction succeeds we can parse the result and use it in our UI.
interface TransactionSuccess<a, b> {
  args: a;
  cmd: Pact.ExecCmd<b>;
  type: "SUCCESS";
  result: Pact.SuccessExecTransactionResponse;
  parsed: b;
}

// This union type captures the lifecycle of a transaction, which moves from
// PENDING to either an error or a success result.
export type TransactionStatus<a, b> =
  | TransactionPending<a>
  | TransactionRequestError<a, b>
  | TransactionExecError<a, b>
  | TransactionSuccess<a, b>;

// Sometimes we want to track the full lifecycle of a transaction, but at other
// times we just want to track the transaction result. We can do that with
// another union type which omits the 'pending' case.
export type TransactionResult<a, b> =
  | TransactionRequestError<a, b>
  | TransactionExecError<a, b>
  | TransactionSuccess<a, b>;

// We can send transactions to a Chainweb node for execution via its 'send'
// endpoint. If we're able to reach the node, we'll receive a request key in
// return which we can use to call the 'poll' endpoint of the node until the
// transaction has failed or succeeded.
//
// This function ties together the 'send' and 'poll' endpoints. It will send our
// request and poll until we receive a response.
export const sendPoll = async function <a, b>(
  buildCmd: (cmdArgs: a) => Pact.ExecCmd<b>,
  args: a
): Promise<TransactionResult<a, b>> {
  // We want to preserve the arguments used to produce this transaction for
  // display in the UI and debugging later, so we defer producing the command
  // until this point.
  let cmd = buildCmd(args);

  // The 'send' endpoint returns a request key we can use to poll for results.
  const sendResponse = await Pact.fetch.send(cmd, apiHost(cmd.meta.chainId));

  if (typeof sendResponse === "string") {
    // If we received a string back, that means the request failed.
    return { args, cmd, type: REQUEST_ERROR, message: sendResponse };
  } else if (!sendResponse.requestKeys[0]) {
    // If there are no request keys, then this is an unexpected failure from the
    // Chainweb node.
    const message = "No request key received from Chainweb node.";
    return { args, cmd, type: REQUEST_ERROR, message };
  }

  // If we *did* receive a request key in response, then we can use it to poll
  // the Chainweb node until we receive a result.
  const requestKey = sendResponse.requestKeys[0];

  while (true) {
    const pollArgs = { requestKeys: [requestKey] };
    const pollResponse = await Pact.fetch.poll(
      pollArgs,
      apiHost(cmd.meta.chainId)
    );

    if (typeof pollResponse === "string") {
      // As before, if we received a string back, that means the request failed.
      return { args, cmd, type: REQUEST_ERROR, message: pollResponse };
    } else if (Object.keys(pollResponse).length === 0) {
      // If the poll endpoint returns an empty object, that means there is not
      // yet a result. We should pause, then poll again for results.
      await (async () =>
        new Promise((resolve) => setTimeout(resolve, 3_000)))();
      continue;
    } else if (pollResponse[requestKey] == undefined) {
      // If we received an object from the poll endpoint, then our transaction
      // data is located under the request key we used to poll. If that key
      // doesn't exist, this is an unexpected failure from the Chainweb node.
      const message = "Request key used to poll not present in poll response.";
      return { args, cmd, type: REQUEST_ERROR, message };
    }

    // If we *did* receive an response with the appropriate key, that means our
    // transaction was processed! We can now determine whether the transaction
    // succeeded. Transaction results are stored under the 'result' key. The
    // 'status' key within the result tells us the fate of our transaction.
    const response = pollResponse[requestKey];
    switch (response.result.status) {
      case "failure":
        const failure = response as Pact.FailedExecTransactionResponse;
        return { args, cmd, type: EXEC_ERROR, result: failure };

      case "success":
        const success = response as Pact.SuccessExecTransactionResponse;
        // In the case we have a successful result, we can parse the resulting
        // data into the type the user specified. In a real-world application
        // our parsing would be more robust; this is sufficient for us.
        const parsed = JSON.parse(JSON.stringify(success.result.data));
        return { args, cmd, type: SUCCESS, result: success, parsed };

      default:
        // And, of course, if we received an unexpected status then once again
        // this is an unexpected error.
        const message = "Did not receive 'failure' or 'success' result status.";
        return { args, cmd, type: REQUEST_ERROR, message };
    }
  }
};

// TODO: Really, exec commands don't need statuses because they just return
// 'write succeeded'. It's the local commands that need the parameter. Or...
// maybe they do, in case you send non-transfer code.
//
// TODO: Provide a method for overriding the chain id? Always override creation
// time, don't require it in the input metadata?

// We can also make it easy to track transaction statuses over time in the UI
// by writing a hook that moves a transaction request through the transaction
// lifecycle, storing each status in state.
type SendPollHook<a, b> = (args: a) => Promise<{
  id: number;
  result: TransactionResult<a, b>;
}>;

export const useSendPoll = function <a, b>(
  buildCmd: (args: a) => Pact.ExecCmd<b>,
  setTransactions: React.Dispatch<
    SetStateAction<Array<TransactionStatus<a, b>>>
  >
): SendPollHook<a, b> {
  const send = async (args: a) => {
    let id = -1;
    setTransactions((old) => {
      const copy = Array.from(old);
      id = copy.length;
      copy.push({ args, type: PENDING });
      return copy;
    });
    const result = await sendPoll(buildCmd, args);
    setTransactions((old) => {
      const copy = Array.from(old);
      copy[id] = result;
      return copy;
    });
    return { id, result };
  };

  return send;
};
