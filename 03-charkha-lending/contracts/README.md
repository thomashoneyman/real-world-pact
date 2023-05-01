# Contracts

This directory holds the Charkha smart contracts, the [protocol unit tests](./test.repl), and the [protocol formal verification](./verify.repl).

I recommend reading through the contracts in the same order they are described [in the Charkha guide](../guide/), which is to say in the following order:

1. **Price Oracle** ([contract](./oracle/oracle.pact), [tests](./oracle/oracle.repl))

   This contract is a simple refresher on Pact contracts, as it has minimal functionality and serves as a simple database.

2. **KETH Ethereum Bridge Token** ([contract](./tokens/keth.pact), [tests](./tokens/keth.repl))

   This contract demonstrates how to implement the fungible-v2 interface for a KIP-0005 token, and should be read before any other tokens (the other contract files omit comments around implementing the interface).

3. **CHRK Governance & Rewards Token** ([contract](./tokens/chrk.pact))

   This contract demonstrates a more advanced token with a capped maximum supply and restricted minting.

4. **Charkha Market Tokens** ([interface](./interfaces/market-interface.pact), [cwKDA](./markets/cwKDA.pact), [cwKETH](./markets/cwKETH.pact), [cwCHRK](./markets/cwCHRK.pact))

   These contracts demonstrate how to write an interface of our own and then implement several simple tokens against it.

5. **Governance Contract** ([contract](./governance.pact))

   This contract is a more complex Pact contract which demonstrates how to implement more sophisticated governance rules; this contract implemetns the Charkha formulas that can be changed according to a vote, where holding 1 CHRK token allows you 1 vote.

6. **Charkha Controlling Contract** ([interface](./interfaces/controller-interface.pact), [contract](./controller.pact))

   This contract brings all the others together into the full implementation of the Charkha protocol. It should be read after all the others, and demonstrates a real-world, sophisticated Pact contract.

The entirety of the Charkha protocol is contained in these contracts. The basic contracts like the oracle and KETH token have accompanying `.repl` test files you can use to see the contract in action. The overall protocol has a [test.repl file](./test.repl) containing the full tests for the protocol.

Each contract also has an accompanying TypeScript binding in [the Charkha app](../frontend/src/contracts) so you can see how this Pact code translates to TypeScript API calls.
