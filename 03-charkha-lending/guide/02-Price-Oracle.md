# Price Oracle

Before we do anything else we need to build a price oracle. A price oracle is ...

## CMC Data

`{{baseUrl}}/v1/cryptocurrency/map?start=1&limit=150&sort=id&symbol=KDA,ETH,COMP`

CMC Identifiers:

- COMP: 5692
- KDA: 5647
- ETH: 1027

Use identifiers to request the latest quote:

`{{baseUrl}}/v2/cryptocurrency/quotes/latest?id=5692,5647,1027`

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

If successful this can be written to the smart contract.
