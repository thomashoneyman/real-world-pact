# Faucet Contract Project

This directory contains the Goliath faucet contract. A "faucet" is a smart contract that distributes funds to users for testing purposes (so they don't have to purchase the coin via an exchange). They are often used on test networks like Kadena's testnet (there is a [testnet faucet](https://faucet.testnet.chainweb.com), by the way). The contract in this directory is our own faucet that we will deploy to our local development blockchain. Then, we will use this faucet in our next project: the Goliath wallet.

This faucet smart contract project will teach you the fundamentals of developing with Pact. Specifically, you'll learn about:

- Pact language features such as keysets, namespaces, modules, interfaces, guards, schemas, tables, governance, and initializing contracts.
- Testing and iterating on contracts with Pact REPL files, including REPL-only functions for measuring gas consumption, formally verifying contracts, and more.
- Generating keypairs and signing transactions with the Pact CLI
- Sending transactions and deploying contracts using the Pact CLI and a tool for HTTP requests

The contract and its associated repl and request files are all fully-commented to explain how you would write them yourself. You should read through them, beginning with the contract itself.

The Goliath faucet is a fully-functioning smart contract. I encourage you to deploy it, execute transactions from the `yaml/send` directory, and query the state of the contract and its related accounts using the requests in the `yaml/local` directory. If you are using the provided Nix shell, then you can use the following commands to run the faucet.repl file to formally verify and test the contract:

```sh
# Enter the Nix shell (use nix-shell if your Nix installation does not support flakes)
nix develop

# Use Pact to run the repl file
pact faucet.repl
```

You can also deploy the contract to a simulation of Chainweb and run requests against the live contract exactly how you would if it were a real contract deployed to mainnet:

```sh
# Enter the Nix shell (use nix-shell if your Nix installation does not support flakes)
nix develop

# Start the simulation blockchain (run devnet-stop to stop the simulation)
devnet-start

# Fund the faucet account and deploy the faucet contract. (This command aliases
# to run-deploy-contract.js; run that script if you aren't using Nix.)
faucet-deploy

# Send transactions and query information about the contract. For more details,
# see the yaml/README.md instructions. (This command aliases to run-request.js;
# run that script if you aren't using Nix.)
faucet-request

# For example, see details about the faucet account we just created:
faucet-request --local faucet-details

# Or request funds from the faucet to a user account:
faucet-request --send request-funds --signers goliath-faucet

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

- `run-request.js` allows you to run any request from the `yaml` directory and review the result. Feel free to add more request files and this script will pick them up automatically! If you're in a Nix shell, this can be run from anywhere in the repository with `faucet-request`.
- `run-deploy-contract.js` chains together several calls to `run-request.js` to create the faucet account and deploy the faucet contract. The contract must be deployed before any of its functions can be called. If you're in a Nix shell, this is aliased to `faucet-deploy`.

## Usage

There are two ways you can interact with the faucet contract: the REPL environment and the devnet environment (via request.yaml files). The REPL allows you to rapidly test and interact with your contract, and it's the best tool to use during development. The devnet environment is a simulation of Chainweb, and it's the best tool to use to test out deployments and requests that you'll make against your contract when it is actually on Chainweb. We use both in our project.

### REPL File

The first way to use the contract is the `faucet.repl` file. I used this file to iterate on the contract while I developed.

The REPL environment is a fantastic way to rapidly test and iterate on your contract. You can use the file in two ways. First, you can simply execute the repl file, which will log the results (including a failure if any test failed):

```
$ pact faucet.repl
```

Alternately, you can run `pact` to enter an interactive repl. Then, load the `faucet.repl` file to run the file. If successful, you will remain in the REPL session and can continue writing Pact code (for example, to continue iterating on the contract using accounts that were set up in the REPL file).

```
pact> (load "faucet.repl")
```

If you just want to set up an environment with the faucet contract and some accounts (but no tests), then you can use the setup file:

```
pact> (load "faucet.setup.repl")
----------
'goliath-faucet' account created:
  - keyset: 'free.goliath-faucet-keyset'
  - public key: 'goliath-faucet-public-key'
  - balance: 1000.0 KDA

'user' account created:
  - keyset: 'free.user-keyset'
  - public key: 'user-public-key'
  - balance: 0.0 KDA
----------
```

For example, now that we're set up, we can interactively request funds for the user account:

```
pact> (env-sigs [{"key": "goliath-faucet-public-key", "caps": [(coin.TRANSFER "goliath-faucet" "user" 20.0)]}])
"Setting transaction signatures/caps"

pact> (free.goliath-faucet.request-funds "user" (describe-keyset "free.user-keyset") 20.0)
"Write succeeded"

pact> (free.goliath-faucet.get-limits "user")
{"account-limit": 100.0,"request-limit": 20.0,"account-limit-remaining": 80.0}
```

Or we can just run formal verification:

```
pact> (verify "free.goliath-faucet")
```

### Request Files

The second way to interact with the faucet contract is to deploy it to [devnet](https://github.com/kadena-io/devnet) and then make requests to devnet. We _could_ use a client library like [pact-lang-api](https://github.com/kadena-io/pact-lang-api) to make these requests, but for this project we're sticking with vanilla Pact. For that reason, we'll use Pact's [request formatter](https://pact-language.readthedocs.io/en/stable/pact-reference.html#api-request-formatter) to turn `request.yaml` files into valid JSON that can be sent to our Chainweb node.

To learn more about how to use `request.yaml` files, including a full walkthrough of building and sending a request of your own, please refer to the [README in the `yaml` directory](./yaml).

There's a little utility included in this project to help you make these requests. If you're in the Nix shell, you can send requests to your local devnet node with `faucet-request`. For example, here's a full session interacting with the contract:

```sh
# Ensure devnet is running
devnet-clean && devnet-start

# Ensure the contract is deployed
faucet-deploy

# Request funds to create the 'user' account
faucet-request --send request-funds --signers goliath-faucet

# Verify the 'user' account has received funds (balance should be '20')
faucet-request --local user-details

# Another way to check is to call (free.goliath-faucet.get-limits)
faucet-request --local user-limits

# Request funds again, this time over the request limit (this will fail; look
# for the 'message' part of the response)
faucet-request --send request-funds-over-limit --signers goliath-faucet

# Update the per-request limit for the user account
faucet-request --send set-user-request-limit --signers goliath-faucet

# Verify the limit has been updated
faucet-request --local user-limits

# This time, requesting funds over the default limit will succeed.
faucet-request --send request-funds-over-limit --signers goliath-faucet

# The user account will now receive their requested 50.0 KDA
faucet-request --local user-details

# We can also update the the per-account limit for the user account
faucet-request --send set-user-account-limit --signers goliath-faucet

# The user limits are now above the defaults
faucet-request --local user-limits

# Finally, we can return funds to the faucet.
faucet-request --send return-funds --signers goliath-faucet,test-user

# The user account has returned 20.0 KDA
faucet-request --local user-limits
```
