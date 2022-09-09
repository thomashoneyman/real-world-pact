#!/usr/bin/env node

/* To deploy the faucet contract we must take two steps:

1. We need to fund the faucet account, if it doesn't already exist.
2. We need to use the faucet account to deploy the contract, if it hasn't
   already been deployed.

Let's take both steps in this short script. This script reuses the functionality
of run-request.js, so you can run these requests from the command line yourself
if you would like. Just provide the given arguments to the ./run-request.js
script directly.
*/

const { parseArgs } = require("./internal/parse-args");
const { runRequest } = require("./run-request");

// Our first function will fund the faucet account, if necessary.
const fundFaucetIfNeeded = async () => {
  const detailsArgs = ["--local", "faucet-details"];
  const faucetDetails = await parseArgs(detailsArgs).then(runRequest);

  if (
    faucetDetails.status === "failure" &&
    faucetDetails.error.message.includes("row not found: goliath-faucet")
  ) {
    console.log(
      "Faucet account not found on local Chainweb node. Funding faucet account..."
    );
    const fundArgs = ["--send", "fund-faucet-account", "--signers", "sender00"];
    const result = await parseArgs(fundArgs).then(runRequest);
    if (result.status === "success") {
      console.log(`Funded! Cost ${result.gas} gas.`);
    } else {
      throw new Error(`Failed to fund account: ${result.error}`);
    }
  } else if (faucetDetails.status === "failure") {
    throw new Error(
      `Unexpected error getting faucet account details: ${faucetDetails.error.message}`
    );
  } else {
    console.log(
      `Faucet account found with ${faucetDetails.data.balance} in funds.`
    );
  }
};

const deployFaucetIfNeeded = async () => {
  const detailArgs = ["--local", "faucet-contract-details"];
  const contractDetails = await parseArgs(detailArgs).then(runRequest);

  if (contractDetails.status === "failure") {
    console.log(
      "Faucet contract not found on local Chainweb node. Deploying contract..."
    );
    const deployArgs = [
      "--send",
      "deploy-faucet-contract",
      "--signers",
      "goliath-faucet",
    ];
    const deployResult = await parseArgs(deployArgs).then(runRequest);
    if (deployResult.status === "success") {
      console.log(`Deployed! Cost: ${deployResult.gas} gas.`);
    } else {
      throw new Error(
        `Failed to deploy contract: ${JSON.stringify(
          deployResult.error,
          null,
          2
        )}`
      );
    }
  } else {
    console.log(
      `Faucet contract exists with the name ${contractDetails.data.name} and hash ${contractDetails.data.hash}`
    );
  }
};

// Finally, we can bring the two together to fund our faucet and then deploy
// the contract using the faucet account.
const main = async () => {
  await fundFaucetIfNeeded();
  await deployFaucetIfNeeded();
};

main();
