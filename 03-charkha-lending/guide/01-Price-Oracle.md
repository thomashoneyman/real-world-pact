# 1. Price Oracles

**Related Reading**

- [Chainlink](https://chain.link/)
- [So You Want to Use a Price Oracle](https://samczsun.com/so-you-want-to-use-a-price-oracle)
- [CoinMarketCap API](https://coinmarketcap.com/api) (10,000 free calls per month, ~13 calls per hour, ~1 call per 5 minutes)

Charkha is a decentralized lending protocol which supports several assets. Anyone can lend an asset and use their deposit as collateral to borrow another asset. But how does Charkha know how much your collateral is worth in terms of another asset?

The relative prices of assets like KDA, BTC, and ETH are an example of "real-world" data — information that can't be computed from the blockchain alone. When you need to know the value of KDA in USD, where do you look? Most likely, you look at an exchange, where the price of KDA is set by the action of buyers and sellers. But a blockchain cannot look at an exchange, because it has no access to the world outside the blockchain.

The traditional solution to bring real-world data to the blockchain is an oracle. Oracles provide a bridge between the real world and smart contracts; they are a source of data that smart contracts can rely and act upon. In its most basic form, an oracle allows a trusted entity to write information to the blockchain. Once that information is on-chain everyone else can use it. But therein lies the danger: if you trust the oracle's data, you are trusting the entity that is writing the data to the blockchain.

A price oracle, specifically, records the price of various asset pairs and stores that data on-chain -- for example, the Chainlink oracle network provides data such as [the price of ETH denominated in USD](https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd). But oracles record all kinds of data ranging from the weather to the results of major sporting events.

Unfortunately, there are no established oracles in the Kadena ecosystem, so we're going to implement a primitive oracle of our own. This is risky; if our prices are incorrect, then bad actors can take advantage of the protocol and cause significant losses. I suggest reading samczsun's article about [price oracle manipulation](https://samczsun.com/so-you-want-to-use-a-price-oracle) to learn more about the risks.

Our primitive oracle will be a smart contract that records the current price of each asset we support, denominated in USD, according to [CoinMarketCap](https://coinmarketcap.com/api). Our lending protocol supports three assets: KDA, the native Kadena token; KETH, a wrapped version of ETH usable on the Kadena blockchain; and CHRK, a governance token that can be used to vote on proposals to change constants about the lending platform.

Of course, KETH and CHRK don't actually exist, so we'll use CoinMarketCap's data for ETH and COMP (the Compound governance token) instead.

## Oracle Contract

Our primitive oracle contract records USD price data from the CoinMarketCap API every few minutes. You can think of this contract as a public price database that anyone on the blockchain can read from, but which only a trusted administrator (Charkha) can write to.

To see how we've implemented it, please see [the Charkha oracle contract](../pact/oracle)!

### Fetching Quotes From The CoinMarketCap API

Our contract is established, but we still need to feed it data.

CoinMarketCap provides [a free API](https://coinmarketcap.com/api) that reports summary data for thousands of digital assets. We're specifically interested in their USD-denominated price reports. In this section I'll briefly describe how we're pulling data from CoinMarketCap and writing it to our smart contract.

First, we need to know what assets we are fetching data for. Charkha supports KDA, KETH (wrapped Ether), and CHRK (the Charkha governance token). CoinMarketCap has data for KDA, but KETH and CHRK don't exist on any real-world blockchains. Instead, we'll use the ETH price data for KETH and the COMP price for CHRK.

Second, we need to know the CoinMarketCap identifiers for these symbols. Technically, more than one asset can use a symbol like KDA, and some assets have changed their symbols over time. For this reason, CoinMarketCap assigns a persistent identifier to every asset on the platform. To look up the correct identifier for each symbol we can use the [cryptocurrency map endpoint](https://coinmarketcap.com/api/documentation/v1/#operation/getV1CryptocurrencyMap):

```json
{{baseUrl}}/v1/cryptocurrency/map?start=1&limit=150&sort=id&symbol=KDA,ETH,COMP
```

From the CoinMarketCap API we can map the following identifiers:

| Symbol | CoinMarketCap ID |
| ------ | ---------------- |
| KDA    | 5647             |
| ETH    | 1027             |
| COMP   | 5692             |

Finally, we can use these identifiers to fetch the [latest quote for each asset](https://coinmarketcap.com/api/documentation/v1/#operation/getV2CryptocurrencyQuotesLatest):

```json
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
