#!/usr/bin/env node

/*

This script is used to execute any request from the 'send' or 'local'
directories. It will format the request file using the Pact CLI and then send
the resulting JSON payload to Chainweb for execution. If the request is a 'send'
request, then it will poll Chainweb until the transaction has been mined and a
result produced.

For usage information, please see the README in the request directory:

*/

const { parseArgs } = require("./internal/parse-args.js");
const localhost = require("./internal/localhost.js");
const util = require("node:util");
const path = require("node:path");
const exec = util.promisify(require("child_process").exec);

// The devnet network ID is 'development', as opposed to 'mainnet01', which is
// the ID for mainnet.
const NETWORK_ID = "development";

// All requests to the faucet happen on chain 0.
const CHAIN = "0";

// This is the path to the Pact API on any Chainweb node. In our case we are
// connecting to devnet on localhost:8080, but we could also connect to the
// mainnet service node at https://api.chainweb.com, or to our own local node.
const apiPath = (endpoint) =>
  `/chainweb/0.0/${NETWORK_ID}/chain/${CHAIN}/pact/api/v1/${endpoint}`;

// All of the request files are kept in the `request` directory of our Pact
// project. We can freely add and remove request files without adjusting this
// script file.
const requestDir = path.join(__dirname, "request");

// This helper function calls out to the Pact CLI to format a local command. For
// more details, see the manual request formatting walkthrough in the README.
const formatLocalRequest = async (request) => {
  const requestPath = path.join(requestDir, "local", request.concat(".yaml"));
  const command = `pact --apireq ${requestPath} --local`;
  const { stdout, stderr } = await exec(command);
  if (stderr) console.error(`Error formatting local request: ${stderr}`);
  return stdout;
};

// This helper function calls out to the Pact CLI to format an exec command. For
// more details, see the manual request formatting walkthrough in the README.
const formatExecRequest = async (request, signers) => {
  const requestPath = path.join(requestDir, "send", request.concat(".yaml"));
  const command = `pact --unsigned ${requestPath}`;
  const getKey = (key) => path.join("keys", key.concat(".yaml"));
  const sigs = signers.map((k) => `| pact add-sig ${getKey(k)}`).join(" ");
  const { stdout, stderr } = await exec(`${command} ${sigs}`);
  if (stderr) console.error(`Error formatting exec request: ${stderr}`);
  return stdout;
};

// This function takes an argument object created by parseArgs() and runs the
// appropriate request.
const runRequest = async (args) => {
  try {
    // First, we use the Pact CLI to format the provided request appropriately.
    // This produces a JSON payload we can then send to the Pact API.
    const formatted = args["send"]
      ? await formatExecRequest(args["send"], args["signers"])
      : await formatLocalRequest(args["local"]);

    // If Pact formatted the command to JSON then we have a valid payload to
    // send off. If the result of formatting produces an error, or continues to
    // return YAML as output, then there is something wrong with the request
    // file or the wrong signature (or wrong number of signatures) was provided.
    try {
      JSON.parse(formatted);
    } catch (err) {
      throw new Error(
        `Command did not format to JSON. If the request file is valid, then you may have provided the wrong signer or too few signers.\n\nReceived:\n${formatted}`
      );
    }

    // Great! At this point we have a valid JSON payload. If the user only
    // wanted the request formatted so they can send it using their preferred
    // HTTP tool, then we simply print the formatted command.
    if (args["format-only"]) {
      return formatted;
    }

    // Otherwise, if they wanted a local request, we can send the request and
    // return the result.
    if (args["local"]) {
      console.log(
        `\n-----\nexecuting 'local' request: ${args["local"].concat(
          ".yaml"
        )}\n-----`
      );
      const res = await localhost.post({
        body: formatted,
        path: apiPath("local"),
      });
      if (args["raw"]) {
        return JSON.stringify(res, null, 2);
      } else {
        return { ...res.result, gas: res.gas };
      }
    }
    // Finally, if they wanted to send a transaction for execution, then we can
    // send the request and retrieve a request key, and then send a second
    // request to the /listen endpoint to wait for the transaction to be mined
    // and a result provided.
    else if (args["send"]) {
      console.log(
        `\n-----\nexecuting 'send' request: ${args["send"].concat(
          ".yaml"
        )}\n-----`
      );
      const sendResult = await localhost.post({
        body: formatted,
        path: apiPath("send"),
      });
      // A successful response will return JSON of the form:
      // { requestKeys: [ key ] }
      if (sendResult["requestKeys"]) {
        const requestKey = sendResult["requestKeys"][0];
        // If we have a request key, then we can send it to the /listen endpoint
        // to await our transaction result.
        console.log(`Received request key: ${requestKey}`);
        console.log("Sending POST request with request key to /poll endpoint.");
        console.log(
          "May take up to 1 minute and 30 seconds to be mined into a block."
        );
        console.log(
          "Polling every 5 seconds until the transaction has been processed..."
        );

        let counter = 0;
        while (true) {
          counter++;
          if (counter % 3 === 0) {
            console.log(`Waiting (${5 * counter} seconds elapsed)...`);
          }
          // We'll only log every 20 seconds, to keep the output tidy.
          const pollResult = await localhost.post({
            body: JSON.stringify({ requestKeys: [requestKey] }),
            path: apiPath("poll"),
          });
          // If we received a string back, that means the request failed.
          if (typeof pollResult === "string") {
            throw new Error(
              `Transaction could not be processed: ${pollResult}`
            );
          }
          // If we received an empty object back, that means the transaction has
          // not yet completed and we should retry.
          else if (Object.keys(pollResult).length === 0) {
            await (async () =>
              new Promise((resolve) => setTimeout(resolve, 5_000)))();
            continue;
          }
          // Otherwise, we have our result.
          else {
            if (args["raw"]) {
              return JSON.stringify(pollResult[requestKey], null, 2);
            } else {
              return {
                ...pollResult[requestKey].result,
                gas: pollResult[requestKey].gas,
              };
            }
          }
        }
      } else {
        throw new Error(
          `Expected to receive a request key, but received ${sendResult}`
        );
      }
    }
  } catch (err) {}
};

const main = async () => {
  // This script is used both to export runRequest and to actually run a request
  // using the command line. We only run the main() function if this was the
  // script that was invoked.
  if (process.argv[1].includes("run-request.js")) {
    try {
      // First, we parse the command-line arguments the user provided. This tells
      // us what request to format, whether it's send or local, and any keys that
      // need to sign the transaction.
      const args = await parseArgs(process.argv.slice(2));
      const result = await runRequest(args);
      console.log(result);
    } catch (err) {
      console.log(err.message);
    }
  }
};

main();

module.exports = { runRequest };
