# Dependencies from the Root Namespace

This directory stores a number of contracts from the "root" namespace of Chainweb that we depend on. These contracts already exist in our local Chainweb node we're using to run devnet, but our REPL files know nothing about them. We store the contracts in our source code so we can load them into the REPL as contracts our faucet contract expects to already exist.

The directory is named "root" after the namespace that these contracts are deployed to. All modules and interfaces in Pact have unique names (such as "goliath-faucet") within a namespace (such as "free"). To refer to a module on Chainweb you must include its namespace as a prefix (such as "free.goliath-faucet"). There is also a reserved namespace referred to as the "root" namespace, where the Kadena team publishes fundamental contracts such as the `coin` contract that defines the behavior of the KDA token. Contracts in this namespace have no prefix at all.

For example, to call the `request-funds` function from the `goliath-faucet` module we must refer to it this way:

```clojure
(free.goliath-faucet.request-funds ...)
```

However, to call the `transfer` function from the `coin` module, we provide no namespace:

```clojure
(coin.transfer ...)
```
