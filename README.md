# Real World Pact

Real World Pact is a short guide and collection of example projects that demonstrate building with Pact on Kadena's Chainweb blockchain. The projects are self-contained and demonstrate critical concepts ranging from beginner to intermediate.

:warning: The projects in this repository are still under development! The Goliath faucet contract and wallet are largely complete, but the core concepts guide and Charkha lending protocol are unfinished.

1. [**Faucet Contract**](./01-faucet-contract) (Complete)
   The faucet contract demonstrates how to write a smart contract with Pact, use the REPL to iterate on and test your code, and use the devnet test blockchain to deploy and interact with your smart contract. You'll learn the core concepts of Pact, such as modules, capabilities, property tests, tables and schemas, dependency management, and deploying your code.

2. [**Goliath Wallet**](./02-goliath-wallet) (Complete)
   The Goliath wallet demonstrates how to build a frontend application in TypeScript + React and use the [pact-lang-api](https://github.com/kadena-io/pact-lang-api) library to interact with Chainweb. You'll learn how to generate accounts, transfer and receive KDA, interact with contracts on-chain from your frontend, and more. Goliath is named after the Goliath bird-eating spider.

3. **Charkha Lending** (Upcoming)
   The Charkha lending platform is an advanced project that demonstrates building a real-world application on Pact and Chainweb. You'll write a lending protocol in a smart contract and a frontend that allows user accounts to access the protocol. You'll learn advanced Pact and Chainweb concepts such as pacts, smart contract performance, governance, and functional programming patterns, as well as some real-world DeFi concepts. Charkha is named for the common spinning wheels used to spin silk.

All three projects expect that you have first read the **Core Concepts**, a short crash-course on building applications with Pact. The projects contain plenty of tests and the frontends are developed with a theme included in this repository; I've made as little use of external libraries as possible so that this code is easy to extend and modify yourself.

## Running the Applications

Each project is fully-functioning – I encourage you to run each one! All the tools you need to run this project are included via a Nix developer shell except for Docker, which you'll need to install yourself if you want to use devnet. Each project has a README describing how to use it.

As a quick demonstration: follow the commands below to start a local simulation of the Chainweb blockchain, deploy the smart contract we write in [Project 1](./01-faucet-contract), and then run the Goliath wallet frontend we build together in [Project 2](./02-goliath-wallet). Open the UI in your browser to send and receive KDA in a simulation of the real Chainweb!

1. Clone the repository and initialize the `devnet` submodule

   ```sh
   git clone git@github.com:thomashoneyman/real-world-pact
   cd real-world-pact
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

- `00-core-concepts`: Contains a short guide covering the core concepts of dapp development with Pact on Chainweb (WIP)
- `01-faucet-contract`: Contains the implementation for our faucet contract (beginner friendly, Pact code)
- `02-goliath-wallet`: Contains the implementation for the Goliath wallet (beginner friendly, TypeScript + React code)
- `03-charkha-lending`: Contains the implementation for the Charkha lending protocol (intermediate, full application)
- `devnet`: Contains a checkout of Kadena's [devnet](https://github.com/kadena-io/devnet) as a Git submodule. This isn't our code! You don't really need to look at it.
- `theme`: Contains the TypeScript for common UI components used in our application. You don't need to look at this, as it's nothing to do with Pact or Chainweb and solely so our apps look good.

## Necessary Tools

This application provisions a developer shell using [Nix](https://nixos.org/download.html). You don't have to use Nix, but I highly recommend it if you are interested in hacking on this repository or running the application. The Nix shell provides all tooling necessary to run all parts of this application, including Pact, the Z3 theorem prover, and NodeJS. It also provides a helpful collection of commands you can run.

Once installed, enter the developer shell:

```sh
# Use nix-shell if you do not have a version of Nix that supports Nix flakes.
nix develop
```

The only tool not included is Docker, which is omitted because it requires specific system permissions. If you want to use devnet then you must have Docker installed.
