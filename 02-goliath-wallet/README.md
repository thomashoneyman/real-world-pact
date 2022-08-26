# Goliath Wallet Project

The Goliath wallet is a TypeScript + React frontend that interacts with Kadena's Chainweb blockchain. It is a minimal but complete frontend application, intended for developers who have built a React application before but are newcomers to Pact and Chainweb. This project builds on the [smart contract we developed in Project 1](../01/faucet-contract/) and demonstrates how to:

- Use the [pact-lang-api](https://github.com/kadena-io/pact-lang-api) library to deploy contracts, send transactions, read and read transaction results from a Chainweb node.
- Write an interface for interacting with the faucet smart contract we developed in Project 1
- Query our local Chainweb node for information across all 20 chains (for example, to retrieve an account's balance on all chains).

Goliath is a fully-functioning frontend; I encourage you to run it yourself, make tweaks, and view the results! If you are using the provided Nix shell, then you can use the following commands to run Goliath:

```console
# Enter the Nix shell
nix develop

# Start the simulation blockchain (run devnet-stop to stop the simulation)
devnet-start

# Fund the faucet account and deploy the faucet contract
faucet-deploy

# Start the Goliath application (Ctrl+C to exit)
goliath-start
```

This project deals only with the frontend part of building a dapp on Chainweb. I highly recommend that you spend time with [the smart contract project](../01-faucet-contract) before moving on to this one, as this project interacts with the faucet contract we developed.

## Wallet Overview

The Goliath wallet is a simple test wallet for Kadena. It assumes you have `devnet` running and have deployed the faucet contract; this frontend makes requests to the faucet contract on your local Chainweb node, just the same way that you'll make requests to a production Chainweb node when you develop your own applications.

### Features

The Goliath wallet is a simple test wallet for sending and receiving KDA. When you load Goliath in your browser you will be given a new wallet address with no funds. Then, the wallet will request 15 KDA on your behalf from the faucet contract.

![](goliath.png)

After that, you can begin to transfer funds using your wallet! The wallet UI is made up of three sections: the navbar, account details, and transaction details.

The navbar provides three actions you can take:

- The "Admin" action allows you to act as the faucet account and update how the faucet contract works (ie. raise or lower the per-request and per-account limits).
- The "Receive Funds" action allows you to request funds from the faucet account to your account on Chain 0.
- The "Send Funds" action allows you to transfer funds from your account on Chain 0 to another chain or back to the faucet account.

The account details section displays your account and KDA holdings across all chains. Each time a transfer is processed your balances are refreshed via a call to the `details` function from the foundational `coin` contract.

Finally, the transaction details section lists each transaction associated with your account. When you initiate a transaction it will be added to the list, and then it will result in a success or failure result and render the associated data from the response.

### Development

You can use the command below to start the wallet frontend in development mode. Feel free to make changes to the source code – the UI will hot-reload with your changes.

```console
pnpm run dev
```

You may wish to open the developer tools with the console and/or network tabs open so that you can see the various requests, responses, and logs we receive from our local Chainweb node.

## Project Structure

The code specific to our wallet is in the `src` directory:

- `App.tsx` is our application. It initializes data, stores the app state, and assembles our UI from our theme components.
- `goliath-faucet.ts` contains the TypeScript implementation of our faucet smart contract. You should read this file and the [faucet smart contract it describes](../01-faucet-contract/faucet.pact) side-by-side.
- `requests.ts` contains various requests that we'll send to Chainweb using the `pact-lang-api` library. It's roughly analogous to the [yaml directory containing request files](../01-faucet-contract/yaml/) from Project 1, so you can see how requests translate between request files and a similar implementation in TypeScript.
- `config.ts` contains configuration specific to our application, such as the network ID and chain that our requests will target and the keypairs for various accounts our wallet will control.

There is also some code not stored in this directory because it is used both for the wallet and for the [Charkha lending protocol project](../03-charkha-lending/). Specifically:

- [`pact-api-utils`](../pact-api-utils/) contains TypeScript types and some utilities on top of the official [pact-lang-api](https://github.com/kadena-io/pact-lang-api) library. The `pact-lang-api` library is written in JavaScript and is a little too low-level to be easy to use in our project. This code is commented if you'd like to read it.
- [`theme`](../theme/) contains the various UI components used to build both frontends. These are typical frontend code and have nothing to do with Pact or Chainweb specifically. This code is not commented.
