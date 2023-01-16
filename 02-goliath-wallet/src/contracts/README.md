# Contracts

This directory implements bindings to two vital contracts:

- `coin-v5.ts` binds to the [coin-v5.pact](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v5/coin-v5.pact) foundational contract. We're only using one function from this contract, so the file is small.
- `goliath-faucet.ts` binds to the [faucet.pact](../../../01-faucet-contract/faucet.pact) contract we developed in Project 1. This is a full set of bindings: all constants and functions are represented here in TypeScript.
