# 2. Fungible Tokens

**Related Reading**:

- [KIP-0002: Define and implement a Pact interface to provide a fungible coin or token standard](https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0002.md)
- [KIP-0005: Define and implement a refinement to the fungible-v1 Pact interface](https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005.md)
- [ERC-20: Ethereum token standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-20)

**Charkha Contracts**

- [KETH contract](../contracts/tokens/keth.pact)
- [KETH tests](../contracts/tokens/keth.repl)
- [The market token interface](../contracts/interfaces/market-interface.pact)
- The [cwKDA](../contracts/markets/cwKDA.pact), [cwKETH](../contracts/markets/cwKETH.pact), [cwCHRK](../contracts/markets/cwCHRK.pact) contracts

**Related Contracts**:

- [The fungible-v2 interface](https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact)
- [The coin-v5 contract, which implements KDA as a KIP-0005 token](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v5/coin-v5.pact)

---

Charkha allows users to borrow and lend various assets including KDA, KETH, and CHRK.

Each supported asset is a _fungible token_. A token is a unit that can represent virtually anything on a blockchain, from ownership of an ounce of gold, or shares in a Kadena mining company, or a linked currency like USD, or more. A _fungible_ token is a token where any unit has the same value and functionality as any other — they are indistinguishable from one another.

You're already familiar with KDA, but the platform also supports two more fungible tokens:

1. **KETH**, or "Kadena Ether": a token representing Ethereum's platform token on Chainweb at a 1:1 value. This token is identical in spirit to [WBTC](https://wbtc.network) in that you can in theory lock up 1 ETH to mint 1 KETH, and burn 1 KETH to retrieve 1 ETH. This is one strategy to bring value from one chain (Ethereum) to another (Chainweb).
2. **CHRK**: the Charkha governance and rewards token, which accrues to suppliers and borrowers every block and which is used to vote on governance proposals.

On Chainweb, as with other blockchains, tokens are implemented in smart contracts. The smart contract provides an API for the token. For example, there should be ways to create tokens, transfer them from one user to another, and check a user's balance.

Tokens are quite common on blockchains because they can be used for so many things. Accordingly, Chainweb has defined a standard for fungible tokens. This standard means we can write smart contracts that can work with _any_ fungible token, so long as they implement the standard.

We'll implement several fungible tokens using this standard, from the KETH bridge token to the CHRK rewards token to the various market tokens that represent a user's collateral.

## The KIP-0005 Token Standard

Kadena defines a standard for implementing tokens on Chainweb called KIP-0005. It's specified in [an interface](https://pact-language.readthedocs.io/en/stable/pact-reference.html#interfaces) named [`fungible-v2`](https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact), which means that the specification is a collection of constants, function signatures, and formal verification models.

Anyone can implement a module against this interface (for example, the foundational [coin-v5](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v5/coin-v5.pact) contract that defines the KDA token is implemented as a [KIP-0005 token](https://github.com/kadena-io/chainweb-node/blob/cdb4424271ccc929394f4001ac1699f571994a69/pact/coin-contract/v5/coin-v5.pact#L20)). More importantly, modules can abstract over this interface using [module references](https://pact-language.readthedocs.io/en/stable/pact-reference.html#module-references) — in other words, you can write an application that works for any token, so long as that token implements the `fungible-v2` interface. We'll rely on this abstraction ability in our contracts.

Every asset listed above will be implemented as a KIP-0005 token, which means it must implement the `fungible-v2` interface. To satisfy this interface we must implement capabilities and functions you will be familiar with from the coin contract, such as the `TRANSFER` capability and the `transfer`, `create-account`, `details`, and `transfer-crosschain` functions. You'll build a deeper understanding of the KDA token by implementing several tokens of your own.

## Implementing KETH (ETH Bridge)

KETH is the simplest of our tokens. It represents ETH on Chainweb such that 1 KETH = 1 ETH and is an example of _bridging_, or the connection of one blockchain ecosystem to another. Before I describe our implementation of KETH, let's take a moment to talk about bridges.

Blockchains like Chainweb and Ethereum are isolated environments with different consensus mechanisms, blockchain state, and other factors that prevent easy interoperability. However, users frequently wish to move assets and information from one blockchain to another.

For example, Chainweb has significantly lower gas fees than Ethereum. A group of users who wish to use ETH for several transactions and want to keep their fees low could bridge their ETH to Chainweb, execute the transactions, and then bridge back to Ethereum. This is the same idea behind [layer 2 rollups](https://ethereum.org/en/developers/docs/scaling/#layer-2-scaling), the primary scaling solution used for Ethereum.

As another example, Ethereum has several decentralized lending applications like Aave and Compound. A lender of ETH on Ethereum might notice that the interest rates for KETH on Charkha are much higher than rates for ETH on Aave or Compound, and decide to bridge their ETH to Chainweb so they can lend it with Charkha. When they wish to withdraw their funds and interest earned, they can bridge back to Ethereum. In short, a bridge enables the movement of assets and information from one chain to another.

You've seen something similar in Chainweb already: a cross-chain transfer is like a bridge in that two chains with independent histories can exchange assets. The difference is that the exchange all happens within the same blockchain, which is considerably more secure than exchanging information between two indedendent blockchain ecosystems.

:warning: Chainweb currently has no bridges. The first attempt for Chainweb was by [Lago Finance, who were hacked shortly after launch and ultimately shut down](https://defillama.com/protocol/lago-bridge). Bridges have [notable](https://old.reddit.com/r/ethereum/comments/rwojtk/ama_we_are_the_efs_research_team_pt_7_07_january/hrngyk8/) [security](https://blog.connext.network/the-interoperability-trilemma-657c2cf69f17) [issues](https://rekt.news/wormhole-rekt/) that make them notoriously exploitable and difficult to implement.

### The KETH Token

The KETH token represents ETH on Chainweb. On Chainweb, this token will be a minimal implementation of the KIP-0005 standard as specified by the fungible-v2 interface. You can [see our implementation of KETH in the `keth.pact` contract](../contracts/tokens/keth.pact).

Conceptually, we will rely on a centralized bridge, in which a central authority is responsible for moving the asset (this requires that you trust the authority). Bridging ETH to KETH works like this:

1. You lock up ETH in a smart contract on the Ethereum blockchain which is controlled by a central authority (Charkha)
2. Charkha signs off on you minting the equivalent KETH on the Chainweb blockchain for your account.

Bridging back works the same way:

1. You burn KETH on Chainweb, destroying it.
2. Charkha signs off on you unlocking your ETH on the Ethereum blockchain.

Our implementation will only cover the Chainweb portions of this process, ie. the ability for you and Charkha to mint KETH for your account and the ability for you to burn your KETH (theoretically, in exchange for the equivalent ETH on Ethereum.)

Hence our smart contract is the fungible-v2 interface plus two functions: `(mint)` and `(burn)`. [See the KETH contract for details](../contracts/tokens/keth.pact)!

## Market Tokens (cwKDA, cwKETH, cwCHRK)

The Charkha protocol establishes money markets for various assets, namely KDA, KETH, and CHRK. We have so far been building foundational infrastructure for these markets. We first established a way to value assets against one another (the price oracle); then, we created our own fungible token that can be used as an asset (KETH). This infrastructure has nothing to do with Charkha specifically; ideally, there would be an established price oracle and ETH bridge on Chainweb already.

In this section we will start building Charkha-specific infrastructure. Specifically, we are going to create three new tokens that I'll refer to as "market tokens" or "interest tokens". These are fungible tokens that represent a user's collateral and which allow them to earn interest on their protocol loans. For code, please see:

1. The [market-interface](../contracts/interfaces/market-interface.pact) market token interface contract
2. The [cwKDA market token](../contracts/markets/cwKDA.pact) contract

But first: why do we need these three extra tokens?

When you lend an asset on Charkha you provide your KDA, KETH, or CHRK to a lending pool, and in exchange you receive cwKDA, cwKETH, or cwCHRK that represents a claim on the assets you have provided. You can reedem your token for the underlying asset at any time.

The reason you receive a claim on the underlying asset is because Charkha needs to be able to transfer your asset to other users of the platform. Once you lend KDA, for example, that exact KDA goes into the lending pool. When another user comes along and wants to borrow KDA, they might receive the KDA you put into the pool. Charkha has guard rails and incentives in place to ensure you can always redeem your cwKDA tokens for KDA.

Market tokens, then, are essentially a simple receipt acknowledging that you have deposited a certain amount of the underlying asset. You are allowed to redeem that receipt at any time to get the underlying asset back — plus interest.

### Market Token Interface

The market tokens are fungible tokens that you can trade to other users, with some restrictions, and so each one implements the `fungible-v2` interface. Most of the information about each market is stored in the controller contract (such as interest rates), and community-controlled information is stored in the governance contract (such as market factors).

However, information about market _participants_ is largely held in the market token contracts. For example, when you lend KDA to the protocol, it is the cwKDA contract that stores information such as:

- your total borrow balance in the market
- your total supplied funds to the market
- the last time interest was compounded on your borrow, and what the interest rate was

Since the market contracts store this information they are the only ones that can update it. The controller contract may set interest rates, for example, but it's the market contracts that actually accrue interest on a particular user account.

We are going to talk in-depth about how the controller and governance contracts work, so in this section I'll simply describe some of the functions that we need our market tokens to expose so that the controller contract can make use of them when synchronizing the protocol.

First, we can look at the information we need to store about every market participant:

```clojure
(defschema participant
  ; Block height of the last update, ie. last interest rate change
  last-updated:integer

  ; The interest rate index at the time of the last update, which is used to
  ; calculate total interest owed at the time of the next update
  last-rate-index:decimal

  ; The user's total collateral in this market (in tokens, not the asset).
  balance:decimal

  ; The user's total borrows in this market.
  borrows:decimal

  ; The user's guard for the account.
  guard:guard)
```

Next, let's look at some of the functions we'll need. First, we need to make the information in this table available to other modules:

```clojure
(defun get-participant:object{participant} (account:string))

(defun get-borrow:decimal (account:string))

(defun get-supply:decimal (account:string))
```

Next, while users technically accrue interest every block, it would be impossible to go through and compound the interest for every user on every block. Instead, we rely on the market controller to maintain an interest rate index. We only concretely apply interest on an account from time to time, when we need to know their exact balance. (This is explained in-depth in the [Charkha Controller](./04-Charkha-Controller.md) section of the guide). Hence, we need an `(accrue-interest)` function that actually updates a user's borrow balance:

```clojure
(defun accrue-interest:decimal (account:string))
```

Second, users are able to supply and borrow funds on Charkha with zero admin participation. The controller contract has a `(supply)` function that can be used to supply funds in a given market, but the controller contract has no ability to mint cwTokens on behalf of a user. Only a market token contract can define that behavior.

We could create a `(mint)` function in the market token contracts that only the Charkha admin can call and which adds cwTokens to a user's balance. However, we don't want any admin intervention in the process. Supplying funds should credit cwTokens automatically and with zero admin signatures — only the supplier should sign the transaction.

So we instead have the controller contract record how many cwTokens a user is owed based on their supplied funds, and then ask the associated market contract to apply the balance change. The controller determines the owed amount, but the market token implements the credit.

```clojure
(defun apply-balance-change:string (account:string guard:guard))
```

See the [market-interface](../contracts/interfaces/market-interface.pact) interface and [cwKDA](../contracts/markets/cwKDA.pact) contract to see all this in action!

## Wrapping Up

You've seen several new fungible tokens and their implementations. When you see that a new exchange or other decentralized app on Kadena has a token of their own, you'll know they implemented it as a KIP-0005 token the same way we've implemented all the tokens in this section of the guide. You've also seen how to add behaviors to a new token, like the (mint) and (burn) functions we added to KETH.

In the next section we'll learn about the CHRK rewards and governance token and how the community can control aspects of the Charkha lending protocol by voting.
