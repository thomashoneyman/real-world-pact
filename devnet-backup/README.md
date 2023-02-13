# Devnet Database Backup

The devnet simulation blockchain begins with no blockchain history and support for only early versions of Pact. We, however, want to use features of recent Pact versions in our code. These features will fail until we reach a late-enough block height on devnet when those features were enabled.

Fortunately, devnet stores its state in the denvent/db/0 directory. As described in the Chainweb documentation, [we can snapshot this directory](https://github.com/kadena-io/devnet#database-bind-mount) so that devnet begins from a sufficient block height.

This directory contains an appropriate snapshot. When you first run `devnet-start` in the development shell your devnet checkout will be initialized with the proper snapshot; subsequent runs will reuse the existing directory. When you run `devnet-clean` the devnet directory will reset to the snapshot.

To see the current block height of the entire chain, run `devnet-start` and then:

```sh
curl -s http://localhost:8080/chainweb/0.0/development/cut | jq '.hashes."'0'".height'
```

At the time of writing, the most recent Pact versions are supported via Chainweb 2.17, which requires a block height of 470:

https://github.com/kadena-io/chainweb-node/blob/323bce436dfbadbf1863580a25d7afddcd76005f/src/Chainweb/Version.hs#L1022
