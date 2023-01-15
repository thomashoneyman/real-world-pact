# Pact REPL Utilities

The Pact REPL is a useful tool for testing smart contract code. A REPL session contains Pact code and, when run, mimics how a blockchain like Chainweb would execute that code. The REPL also provides several REPL-only functions that can be used to measure gas consumption, commit and roll back transactions, throw exceptions, and more.

However, the REPL is also minimal. It does not have any of the namespaces, contracts, guards, or other data that exists on Chainweb. All significant Pact code bases will require that the REPL is populated with this data. For example, our faucet contract relies on the 'coin-v5' Kadena contract, which defines operations for the KDA token. In order to refer to that dependency we must "deploy" it to our REPL environment.

This directory stores a number of helper files for initializing a REPL environment that mimics what we expect Chainweb to contain at the time we deploy our actual contracts. Each of our test REPL files will begin with this line:

```clojure
(load "../pact-repl-utils/init.repl")
```

This will execute the `init.repl` session, which constructs our REPL environment. See each `init-*` file for a description of what is being initialized and why. After initialization, we will have:

- Basic namespaces like `free` and `user`
- Several foundational contracts, such as the `coin` contract that governs the KDA token
- Three accounts (`sender00`, `sender01`, and `sender01`), along with their respective keysets (`sender00-keyset`, etc.), each funded with 1000 KDA. Note: these accounts are also present on devnet, so you can write code for both the REPL and devnet test environments with these accounts.
