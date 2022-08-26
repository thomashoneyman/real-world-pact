# Faucet Contract Project

This directory contains the Goliath faucet contract. A "faucet" is a smart contract that distributes funds to users for testing purposes (so they don't have to purchase the coin via an exchange). They are often used on test networks like Kadena's testnet (there is a [testnet faucet](https://faucet.testnet.chainweb.com), by the way). The contract in this directory is our own faucet that we will deploy to our local development blockchain. Then, we will use this faucet in our next project: the Goliath wallet.

This faucet smart contract project will teach you the fundamentals of developing with Pact. Specifically, you'll learn about:

- Pact language features such as keysets, namespaces, modules, interfaces, guards, schemas, tables, governance, and initializing contracts.
- Testing and iterating on contracts with Pact REPL files, including REPL-only functions for measuring gas consumption, formally verifying contracts, and more.
- Generating keypairs and signing transactions with the Pact CLI
- Sending transactions and deploying contracts using the Pact CLI and a tool for HTTP requests

The Goliath faucet is a fully-functioning smart contract. I encourage you to deploy it yourself, execute transactions from the `yaml/send` directory, and query the state of the contract and its related accounts using the requests in the `yaml/local` directory. If you are using the provided Nix shell, then you can use the following commands to deploy the contract and run requests against it:

```console
# Enter the Nix shell
nix develop

# Start the simulation blockchain (run devnet-stop to stop the simulation)
devnet-start

# Fund the faucet account and deploy the faucet contract
./run-deploy-contract.js

# Send transactions and query information about the contract. For more
# details, see the yaml/README.md instructions
./run-request.js

# For example, see details about the faucet account we just created:
./run-request.js --local faucet-details

# Or request funds from the faucet to a user account:
./run-request.js --send request-funds --signers goliath-faucet

# If you ever want to reset the simulation blockchain to its initial state
# so you can test deploying from scratch:
devnet-clean && devnet-start
```

## Contract Overview

The Goliath faucet is a simple contract that allows users to request KDA on our local devnet. Even though it's a small contract, we'll cover the majority of Pact's features in the process of building it. The faucet contract is only intended for use on a test network, so it will allow anyone to request funds. However, there are some restrictions:

1. There is a limit to how much can be transferred in a single request.
2. There is a limit to how much can be transferred in total to a single address.

These safeguards help prevent a single address from draining the faucet. To implement them, we'll leverage Pact features like schemas, tables, and guards. We'll also use formal verification to prove these limits cannot be exceeded by any particular address.

Our contract is transferring funds from the faucet address to another address, which means we will depend on the fundamental `coin` contract. This contract provides helpful functions like `transfer` which facilitate transferring KDA from one address to another. Transfers are sensitive operations, so they are guarded by _capabilities_, which are Pact's built-in authorization system. We'll learn how to sign transactions with capabilities to authorize sensitive operations such as transfers.

Finally, our faucet transfer limits will be configurable. The faucet account can raise or lower the limits at any time. To ensure _only_ the faucet account has this privilege, we'll implement some capabilities of our own!

## Project Structure

This directory demonstrates a typical structure for a smart contract. It consists of a two main files:

- `faucet.pact` is the source code for our faucet smart contract.
- `faucet.repl` is the accompanying REPL file for our smart contract, which contains tests and formal verification for our contract.
- `faucet.setup.repl` is a helper REPL file that loads dependencies, sets up test accounts, and funds the faucet account to make building other REPL files easy.

There are also two directories (well, three, but `internal` is just helper code for scripts):

- `yaml` contains request files that can be used with the Pact CLI and a tool for HTTP requests to interact with Chainweb directly. It also includes several keypairs we'll use for testing (such as the keypair for the Goliath faucet account). Please see the [README in the `yaml` directory](./yaml/) for a thorough walkthrough -- this is an important topic!
- `root` contains a few foundational contracts developed by Kadena that our contract depends on. While these contracts will exist on Chainweb when we deploy our contract, we need to version them in our project so our REPL file can use them.

Finally, there are some scripts that you can use to deploy the contract and interact with it on devnet (our development Chainweb node):

- `run-request.js` allows you to run any request from the `yaml` directory and review the result. Feel free to add more request files and this script will pick them up automatically!
- `run-deploy-contract.js` chains together several calls to `run-request.js` to create the faucet account and deploy the faucet contract. The contract must be deployed before any of its functions can be called.
- `run-integration-test.js` replicates the `faucet.repl` file's tests, but this time running on our local Chainweb node in a simulation of a real-world session using the contract! It's slow, as each transaction has to be mined into a block, but it gives us confidence the code will work as expected when deployed to a more real-world network.

## Usage

There are two ways you can interact with the faucet contract: the REPL environment and the devnet environment (via request.yaml files). The REPL allows you to rapidly test and interact with your contract, and it's the best tool to use during development. The devnet environment is a simulation of Chainweb, and it's the best tool to use to test out deployments and requests that you'll make against your contract when it is actually on Chainweb. We use both in our project.

In fact, you'll notice that we have two similar files: `faucet.repl` and `run-integration-test.js`. The REPL file exercises our contract in the REPL environment, and it's what I used to iterate on and develop the contract in the first place. The integration test exercises our contract again, but this time in the devnet environment that mirrors a production environment. I highly encourage you to look at these two files side-by-side to see how Pact code translates in the two different environments.

### REPL File

The first way to use the contract is the `faucet.repl` file. The REPL environment is a fantastic way to rapidly test and iterate on your contract. You can use the file in two ways. First, you can simply execute the repl file, which will log the results (including a failure if any test failed):

```
$ pact faucet.repl
```

Alternately, you can run `pact` to enter an interactive repl. Then, load the `faucet.repl` file to run the file. If successful, you will remain in the REPL session and can continue writing Pact code (for example, to continue iterating on the contract using accounts that were set up in the REPL file).

```
pact> (load "faucet.repl")
```

### Request Files

The second way to interact with the faucet contract is by deploying it to [devnet](https://github.com/kadena-io/devnet) and then making requests to the local devnet Chainweb node. A full application might use the [pact-lang-api](https://github.com/kadena-io/pact-lang-api) JavaScript library to make requests in a frontend application, but for this project we're doing contract development with no frontend. For that reason, we'll use Pact's [request formatter](https://pact-language.readthedocs.io/en/stable/pact-reference.html#api-request-formatter) to turn `request.yaml` files into valid JSON that can be sent to our Chainweb node. To learn more about how to use `request.yaml` files, including a full walkthrough of building and sending a request of your own, please refer to the [README in the `yaml` directory](./yaml/).
