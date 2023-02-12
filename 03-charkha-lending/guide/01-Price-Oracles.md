# 1. Price Oracles

**Related Reading**

- [Oracles (Ethereum Developer Docs)](https://ethereum.org/en/developers/docs/oracles/)
- [So You Want to Use a Price Oracle](https://samczsun.com/so-you-want-to-use-a-price-oracle)
- [The Dangers of Price Oracles](https://blog.openzeppelin.com/secure-smart-contract-guidelines-the-dangers-of-price-oracles/)

**Charkha Contracts**

- [Oracle contract](../contracts/oracle/oracle.pact)
- [Oracle tests](../contracts/oracle/oracle.repl)

**Related Contracts**

- [nuwu's consensus-based oracle](https://github.com/41906/oracle)

---

Charkha is a decentralized lending protocol that supports assets including KDA, KETH, and CHRK. Anyone can lend an asset and use their deposit as collateral to borrow another asset. Lending and borrowing happens via smart contracts written in Pact, with no administrator intervention.

Of course, with no administrator to approve or deny loans, we must rely on our smart contracts to enforce rules that prevent the protocol from [accumulating bad debts](https://www.investopedia.com/terms/b/baddebt.asp) (loans to borrowers who can't or won't repay them).

Charkha has one big rule for borrowers: you can borrow up to your _borrowing capacity_, which is the sum of the value of the assets you have loaned to the protocol (ie. [your collateral](https://www.investopedia.com/terms/c/collateral.asp)), multiplied by the _collateral ratio_ for each type of asset you have loaned.

To enforce this rule our smart contract must know the relative value of KETH and KDA, and this information must be available on the blockchain (smart contracts cannot access any other sources of information). However, the value of an asset like KDA fluctuates all the time — how can our smart contract _accurately_ compare the prices of KDA and KETH?

We need a price oracle.

## Real World Data & Oracles

The relative prices of assets like KDA, BTC, and ETH are an example of "real-world" data — information that can't be computed from the blockchain alone. When you need to know the value of KDA in USD, where do you look? Most likely, you look at an exchange, where the price of KDA is set by the action of buyers and sellers. But a blockchain cannot look at an exchange, because it has no access to the world outside the blockchain.

The traditional solution to bring real-world data to the blockchain is an oracle. Oracles provide a bridge between the real world and smart contracts; they are a source of data that smart contracts can rely and act upon. In its most basic form, an oracle allows a trusted entity to write information to the blockchain. Once that information is on-chain, it is unalterable and publicly available, which means that Chainweb nodes can use it to execute smart contracts without breaking consensus.

But therein lies the danger: if you trust the oracle's data, you are trusting the entity that is writing the data to the blockchain. It's quite easy to implement an oracle (you're just writing some data to the blockchain), but it's difficult to create a _reliable_ oracle. The difficulty in writing a trustless, reliable oracle has led to the term "the oracle problem" and a number of companies (such as [Chainlink](https://chain.link)) that promise to solve it.

There are two good questions to ask when considering whether an oracle is trustworthy:

1. How can you verify the information written to the blockchain came from the correct source and hasn't been tampered with or manipulated?
2. How can you verify the data is always available and updated regularly?

As with crypto exchanges, oracles can range from fully centralized to fully decentralized.

A _price oracle_ is a specific type of oracle that records the price of various asset pairs and stores that data on-chain -- for example, the Chainlink oracle network provides data such as [the price of ETH denominated in USD](https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd).

## Implementing a Centralized Oracle

Unfortunately, there are no established oracles in the Kadena ecosystem, so we're going to implement a primitive oracle of our own. This is risky; if our prices are incorrect, then bad actors can take advantage of the protocol and cause significant losses. I suggest reading samczsun's article about [price oracle manipulation](https://samczsun.com/so-you-want-to-use-a-price-oracle) to learn more about the risks.

Our primitive oracle will be a smart contract that records the current price of each asset we support, denominated in USD, according to [CoinMarketCap](https://coinmarketcap.com/api). Our lending protocol supports three assets: KDA, the native Kadena token; KETH, a wrapped version of ETH usable on the Kadena blockchain; and CHRK, a governance token that can be used to vote on proposals to change constants about the lending platform.

Of course, KETH and CHRK don't actually exist, so we'll use CoinMarketCap's data for ETH and COMP (the Compound governance token) instead.

### The Oracle Contract

A centralized price oracle is simple to implement. The oracle administrator (us) simply writes to the contract database every time the third-party data source changes. This creates a data feed; users of the price oracle can call a `(get-price ASSET)` function in the contract at any time to see the last-written value of that asset in some denomination, such as USD.

For example, our oracle contract can create a price feed as a simple table:

```clojure
(defschema asset
  @model [ (invariant (>= usd-price 0.0)) ]
  usd-price:decimal
  last-updated:time)

; Assets are keyed by symbol, e.g. "KDA"
(deftable asset-table{asset})
```

The administrator can register specific assets that they promise to keep updated, with some formal verification representing promises we must keep (only the administrator can register assets; you can't register an asset twice; assets can never have negative values).

```clojure
(defun register-asset:string (asset:string usd-price:decimal)
  ...)
```

Once registered, the administrator can set the price of an asset at any time (here's where the trust comes in!). This would be sent to a Chainweb node as a transaction, signed by the administrator, containing Pact code like `(set-price "KDA" 1.34)`.

```clojure
(defun set-price:string (symbol:string usd-price:decimal)
  ...)
```

Users, on the other hand, can request the price of an asset at any time from the feed. The relative prices of KDA and KETH are now available to our borrowing capacity enforcement function!

```clojure
(defun get-price:decimal (symbol:string)
  ...)
```

Our primitive oracle contract records USD price data from the CoinMarketCap API every few minutes. You can think of this contract as a public price database that anyone on the blockchain can read from, but which only a trusted administrator (Charkha) can write to.

To see how we've implemented it, please see [the Charkha oracle contract](../contracts/oracle/oracle.pact)!

### The Oracle Data Source (CoinMarketCap API)

Our contract is established, but we still need to feed it data.

CoinMarketCap provides [a free API](https://coinmarketcap.com/api) that reports summary data for thousands of digital assets. We're specifically interested in their USD-denominated price reports. In this section I'll briefly describe how we're pulling data from CoinMarketCap and writing it to our smart contract.

First, we need to know what assets we are fetching data for. Charkha supports KDA, KETH (wrapped Ether), and CHRK (the Charkha governance token). CoinMarketCap has data for KDA, but KETH and CHRK don't exist on any real-world blockchains. Instead, we'll use the ETH price data for KETH and the COMP price for CHRK.

Second, we need to know the CoinMarketCap identifiers for these symbols. Technically, more than one asset can use a symbol like KDA, and some assets have changed their symbols over time. For this reason, CoinMarketCap assigns a persistent identifier to every asset on the platform. To look up the correct identifier for each symbol we can use the [cryptocurrency map endpoint](https://coinmarketcap.com/api/documentation/v1/#operation/getV1CryptocurrencyMap):

```
{{baseUrl}}/v1/cryptocurrency/map?start=1&limit=150&sort=id&symbol=KDA,ETH,COMP
```

From the CoinMarketCap API we can map the following identifiers:

| Symbol | CoinMarketCap ID |
| ------ | ---------------- |
| KDA    | 5647             |
| ETH    | 1027             |
| COMP   | 5692             |

Finally, we can use these identifiers to fetch the [latest quote for each asset](https://coinmarketcap.com/api/documentation/v1/#operation/getV2CryptocurrencyQuotesLatest):

```
{{baseUrl}}/v2/cryptocurrency/quotes/latest?id=5692,5647,1027
```

The result will look something like this (with extraneous information trimmed out):

```json
{
  "data": {
    "1027": {
      "quote": {
        "USD": {
          "price": 1273.3687535066615
        }
      }
    },
    "5647": {
      "quote": {
        "USD": {
          "price": 1.0026710755733965
        }
      }
    },
    "5692": {
      "quote": {
        "USD": {
          "price": 39.23267256149772
        }
      }
    }
  }
}
```

Hence, at the time I made this request, our price oracle should be updated to reflect these prices:

| Asset | Price     |
| ----- | --------- |
| KDA   | $1.00     |
| ETH   | $1,273.37 |
| COMP  | $39.23    |

Updating our contract is as simple as hitting the `/send` endpoint of our local Chainweb node with the admin capability granted and the following Pact code:

```clojure
(set-price "KDA" 1.00)
(set-price "ETH" 1273.37)
(set-price "COMP" 39.23)
```

The CoinMarketCap API [has rate limits depending on your pay tier](https://coinmarketcap.com/api/features); on the free tier we can make at most 300 daily calls, which works out to roughly 1 call every 5 minutes. This makes our oracle unusable in the real world — 5 minutes of delay is significant — but it'll be reasonably up to date for our tests.
