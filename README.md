# Real World Pact

Real World Pact is a series of thoroughly-commented, fully-functioning projects that demonstrate building decentralized apps with Pact on Kadena's Chainweb blockchain. The projects range from beginner to advanced; each can be deployed to a local devnet or to testnet and has an accompanying UI that demonstrates how to build a frontend to connect to your smart contracts.

Begin with the **Pact Core Concepts** series:

1. [Introduction to Blockchain Development with Kadena](./00-core-concepts/01-Introduction.md)
2. [Learn Pact in 20 Minutes](./00-core-concepts/02-Pact-In-20-Minutes.md)
3. [Testing and Formal Verification in the Pact REPL](./00-core-concepts/03-Testing-In-The-Pact-REPL.md)

Then, you can move through the projects below one-by-one. If you are already familiar with Pact and just want to see a significant, real-world example, then you can skip straight to the [Charkha lending protocol](./03-charkha-lending).

## Pact Projects

Real World Pact includes three projects. Each project assumes that you have read the [**Pact Core Concepts**](./00-core-concepts) series and is otherwise self-contained.

1. [**Goliath Faucet Contract**](./01-faucet-contract) (Beginner, Pact)

   The faucet contract demonstrates how to write a smart contract with Pact, use the REPL to iterate on and test your code, and use the devnet test blockchain to deploy and interact with your smart contract. You'll learn the core concepts of Pact, such as modules, capabilities, property tests, tables and schemas, dependency management, and deploying your code.

2. [**Goliath Wallet UI**](./02-goliath-wallet) (Beginner, TypeScript + React)

   The Goliath wallet demonstrates how to build a frontend application in TypeScript + React and use the [pact-lang-api](https://github.com/kadena-io/pact-lang-api) library to interact with Chainweb. You'll learn how to generate accounts, transfer and receive KDA, interact with contracts on-chain from your frontend, and more. Goliath is named after the Goliath bird-eating spider.

3. **[Charkha Lending Protocol](./03-charkha-lending)** (Intermediate / Advanced, Full Stack)

   The Charkha lending protocol is an advanced project that demonstrates building a real-world application on Pact and Chainweb. You'll see how to implement a white paper describing a lending protocol as a set of smart contracts. You'll also connect a full frontend to the protocol. You'll learn a mixture of Pact, Chainweb, and DeFi concepts, such as oracles, community governance, implementing your own tokens, minimizing gas fees, and more. Charkha is named for the common spinning wheels used to spin silk.

There are also two directories containing utility code which you should review:

1. **[Pact REPL Utils](./pact-repl-utils)** (Pact)

   The Pact REPL simulates contract operations on a Pact-supporting blockchain such as Chainweb. However, the REPL has no knowledge of the namespaces, guards, and contracts that have been deployed to Chainweb. The REPL utilities help you set up your REPL to mimic the Chainweb environment you will be deploying to -- such as making dependencies like the `coin-v5` contract available.

2. **[Pact API Utils](./pact-api-utils)** (TypeScript + React)

   The [pact-lang-api](https://github.com/kadena-io/pact-lang-api) library provides basic building blocks for interacting with the Pact endpoint on a Chainweb node. However, it's too low-level for use in a serious application, so I've implemented a layer on top of it we'll use to build and send requests in our TypeScript & React applications. Feel free to use it in your own projects!

## Running the Apps

Each project is fully-functioning – I encourage you to run each one! All the tools you need to run this project are included via a Nix developer shell except for Docker, which you'll need to install yourself if you want to use devnet. Each project has a README describing how to use it.

As a quick demonstration: follow the commands below to start a local simulation of the Chainweb blockchain, deploy the smart contract we write in [Project 1](./01-faucet-contract), and then run the Goliath wallet frontend we build together in [Project 2](./02-goliath-wallet). Open the UI in your browser to send and receive KDA in a simulation of the real Chainweb!

1. Clone the repository and initialize the `devnet` submodule

   ```sh
   git clone https://github.com/thomashoneyman/real-world-pact.git
   cd real-world-pact
   git submodule update --init
   ```

2. Enter the Nix developer shell, which provides all the tools you need except for Docker

   ```sh
   # Use nix-shell if you do not have a version of Nix that supports Nix flakes.
   nix develop
   ```

3. Start the simulation Chainweb (run `devnet-stop` to stop the simulation)

   ```sh
   devnet-start
   ```

4. Deploy the faucet contract to the simulation Chainweb

   ```sh
   faucet-deploy
   ```

5. Start the Goliath wallet application (Ctrl+C to exit)

   ```sh
   goliath-start
   ```

You don't have to use Nix. If you would prefer not to, then you should install `pact`, `nodejs`, `pnpm`, and `z3` yourself. Then, use the `devshell.toml` file to see the definitions of `devnet-start`, `faucet-deploy`, and so on, and run those commands.

## Structure

This repository is broken into several directories. You can look at the README.md stored in each directory for more detailed information about each piece. Use the list below to help guide yourself:

- `01-faucet-contract`: Contains the implementation for our faucet contract (beginner friendly, Pact code)
- `02-goliath-wallet`: Contains the implementation for the Goliath wallet (beginner friendly, TypeScript + React code)
- `03-charkha-lending`: Contains the implementation for the Charkha lending protocol (intermediate, full application)
- `pact-repl-utils`: Contains Pact utilities for working in the Pact REPL.
- `pact-api-utils`: Contains TypeScript utilities for working with the Pact API on a Chainweb node.
- `devnet`: Contains a checkout of Kadena's [devnet](https://github.com/kadena-io/devnet) as a Git submodule. This isn't our code! You don't really need to look at it.
- `devnet-backup`: Contains a snapshot of the devnet local database so that we can reset devnet to a clean state (none of our contracts exist), but which still supports recent Pact versions.
- `theme`: Contains the TypeScript for common UI components used in our application. You don't need to look at this, as it's nothing to do with Pact or Chainweb and solely so our apps look good.

## Necessary Tools

This application provisions a developer shell using [Nix](https://nixos.org/download.html). You don't have to use Nix, but I highly recommend it if you are interested in hacking on this repository or running the application. The Nix shell provides all tooling necessary to run all parts of this application, including Pact, the Z3 theorem prover, and NodeJS. It also provides a helpful collection of commands you can run.

Once installed, enter the developer shell:

```sh
# Use nix-shell if you do not have a version of Nix that supports Nix flakes.
nix develop
```

The only tool not included is Docker, which is omitted because it requires specific system permissions. If you want to use devnet then you must have Docker installed.
