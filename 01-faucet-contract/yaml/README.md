# Faucet YAML Files

The Pact CLI can [format request files](https://pact-language.readthedocs.io/en/stable/pact-reference.html#api-request-formatter) like the ones in this directory into JSON payloads. You can then make a POST request with the JSON to a Chainweb node for execution. Request files make it possible to execute arbitrary Pact code with nothing but a yaml file, `pact`, and a tool for HTTP requests such as `curl`; they're a flexible, wonderful tool for executing snippets of Pact code in a real-world environment.

When developing your own smart contracts you will mostly use a REPL file like `faucet.repl` to iterate on your Pact code and test your contract. However, it's also valuable to deploy your contract to a Chainweb node and then execute transactions on that node. Doing so simulates how your contract will behave when deployed to a real-world network like mainnet. Accordingly, it's common to have a `yaml` directory containing request files. For example, here's [the Marmalade yaml directory](https://github.com/kadena-io/marmalade/tree/fe6b786063ba2082c56a1ff917dbaf14cf6f61be/pact/yaml).

Our `yaml` directory contains all the requests needed to create the faucet account, deploy the faucet contract, and then exercise each function in the contract.

## Usage

:warning: Before we begin: you must have devnet running in order for these requests to work. If you are using the Nix shell, you can run `devnet-start`. If not, please refer to the [devshell](../../devshell.toml) file for instructions on starting devnet.

There are several ways to use the request files in this directory. I recommend that you try them all, making tweaks to ensure you fully understand not only how these specific requests work, but how processing transactions on a Chainweb node works more generally.

This README contains a complete walkthrough for [manually formatting and sending a request](#using-request-files-manually). I recommend following along with this walkthrough; you can immediately apply what you've learned to your own projects. However, it's tedious to format and send requests manually, so I have included some scripts in this repository to help you use the request files in this directory.

### Deploy the faucet contract

Before you make requests to the faucet contract it must be deployed. There are request files for [funding the faucet account](./send/fund-faucet-account.yaml) and then using it to [deploy the faucet contract](./send/deploy-faucet-contract.yaml). You could execute these transactions yourself, but there is also a [run-deploy-contract.js](../run-deploy-contract.js) script that will take care of these steps for you.

With the faucet contract deployed, you can now execute any request in the `local` or `send` directories.

### Execute a single request

You can use the [run-request.js](../run-request.js) script to execute any request in the `local` or `send` directories. Local requests will return a result immediately, but the exec requests in the `send` directory take between 30 and 90 seconds to complete since they must be mined into a block (blocks are mined every 30 seconds).

To see all available transactions and keys:

```console
./run-request.js
./run-request.js --local # to only see local requests
./run-request.js --send # to only see exec requests
```

To execute a 'send' transaction, use the `--send` argument to provide the name of the request and the `--signers` flag to list the keys for any required signers. For example, to fund the faucet account:

```console
./run-request.js --send fund-faucet-account --signers sender00
```

If you write a request file that needs multiple signers you can comma-separate them, e.g. `--signers sender00,goliath-faucet`.

To execute a 'local' transaction, use the `--local` argument to provide the name of the request. For example, to look up the account details for the faucet account (this will fail if the faucet has not yet been funded):

```console
./run-request.js --local faucet-details
```

By default the script will only output the `result` field of the response. To see the entire raw response the Chainweb node returns, include the `--raw` flag:

```console
./run-request.js --raw --local faucet-details
```

If you only want to get the formatted JSON payload for a request and would like to send it yourself (for example, you want to load it into `postman`), then you can pass the `--format-only` flag in addition to the other arguments.

```console
./run-request.js --format-only --local faucet-details
```

This will print the formatted JSON to the console, which you can copy and paste into the tool of your choosing. Please note that the JSON payload will expire after a while when the `creationTime` gets too old and you'll need to run this command again.

### Run the integration test

Finally, you can use the [run-integration-test.js](../run-integration-test.js) script to run the full integration test. This test mirrors the [faucet.repl](../faucet.repl) file, and I encourage you to open them side-by-side and compare them!

The integration test will fund the faucet and deploy the contract if necessary. Then, it will return all funds from the user account to the faucet account. Finally, it will execute various functions from the faucet contract and ensure they succeed when they're supposed to and fail when they're not supposed to.

I encourage you to extend the faucet contract yourself, adding your own request files and tweaking the integration test accordingly.

## Directory Structure

Here's the structure of our yaml directory:

- The `keys` directory contains the public and secret key for various accounts we will use in our tests. The `sender00` keys are taken [from the chainweb-node repo](https://github.com/kadena-io/chainweb-node/blob/master/pact/genesis/devnet/keys.yaml) and control an account included in our local devnet automatically, which has funds we can use to fund our faucet account. The `goliath-faucet` keys control the faucet account, and I generated them with the Pact CLI. The `test-user` keys are another pair of generated keys, and they control an test account we'll use to request funds from the faucet.
- The `local` directory contains request files intended for the [/local endpoint](https://api.chainweb.com/openapi/pact.html#tag/endpoint-local/paths/~1local/post). The /local endpoint is for Pact code that does not write to the blockchain, and therefore doesn't need to be mined into a block and can be executed solely on your local Chainweb node. We'll use local execution to look up information about accounts and modules and verify that our transactions have indeed changed the state of the blockchain.
- The `send` directory contains request files intended for the [/send endpoint](https://api.chainweb.com/openapi/pact.html#tag/endpoint-send/paths/~1send/post). The /send endpoint is for Pact code that executes a transaction on Chainweb and therefore must be mined into a block. We'll use this endpoint to create the faucet account, deploy the faucet contract, and call the contract to transfer funds.

Each request file is commented, and I encourage you to read through each one — particularly those in the `send` directory.

## Using Request Files Manually

Request files are formatted by the Pact CLI into a JSON payload, which we can then send to the relevant Pact endpoint on our local Chainweb node (or to mainnet via [api.chainweb.com](https://api.chainweb.com). In the rest of this README we'll walk through how to do this yourself using `pact` and `curl`, though the formatted JSON payload can be used with any HTTP tool, such as `postman` or a Node script.

In the next few sections, we will learn how to:

1. Format a local request
2. Format and sign an exec request (a single-chain transaction)
3. Send local and exec requests to a Chainweb node
4. Retrieve the results of an exec request (ie. a transaction)

To follow along you'll need the Pact executable and a tool for making HTTP requests.

### 1. Formatting Local Requests

Local requests are for Pact code that is only executed on the target Chainweb node, where nothing is mined into a block. They are for reading data from the blockchain. They're easier to work with than other transactions for this reason.

To format a local request, call the `pact` CLI using these arguments:

- `--local`: Indicates this is a local command intended for the `/local` endpoint.
- `--apireq <path-to-yaml>`: Formats and signs the command, expecting all key pairs necessary for the signatures to be already present in the file. We can use this for local requests without providing any key pairs because they don't need to be signed.

Here's an example of formatting the `faucet-details` request that fetches details on the goliath-faucet account:

```
$ pact --local --apireq yaml/local/faucet-details.yaml
{ "hash":"R9bx4sw7_UhCWyf6AwCsjfSFkFTxRDON7TKgrP2YnUk", ... }
```

You can now take this JSON payload and send it to the `/local` Pact API endpoint on a Chainweb node! We'll see how to do that in step 3.

### 2. Formatting Exec Requests

"Exec" (ie. execution) requests are for Pact code that represents a transaction which must be mined into a block and is broadcast to other nodes by the target Chainweb node. They are for writing data to the blockchain. When you send a transaction to be mined you will receive a request key in return, which you can send to the `/poll` or `/listen` endpoints to wait for the transaction to be mined and then retrieve its result.

Unlike local requests, execution requests are signed using a keypair like those stored in the `keys` directory. That's because these requests are mined, and therefore someone must pay the gas fees associated with mining the transaction. You may also need to scope signatures on the transaction to particular capabilities. In this section we'll learn how to format and sign execution requests.

> Note: There are also "cont" (ie. continuation) requests used for transactions that span multiple chains, but we aren't using them in our project. To see examples of continuation requests, please refer to the [Charkha lending project](../../03-charkha-lending/).

You can format a request file into a JSON payload to send to a Chainweb node using the Pact CLI. Since we are committing these files to our repository, we are going to use Pact's [detached signature mode](https://pact-language.readthedocs.io/en/stable/pact-reference.html#detached-signature-transaction-format) in our request files. That means our request files only contain the public key for each transaction signer, and we'll provide the secret key to Pact directly.

Let's try to format our `fund-faucet-account.yaml` request:

```console
pact --unsigned yaml/send/fund-faucet-account.yaml
```

If you run this yourself, you'll notice that we received YAML as output instead of JSON. That's because our request requires a signature from the `sender00` account keys but we haven't provided it. You can add a new signature to a transaction using `pact add-sig [KEY_FILE]`. The faucet keypair is stored in the `yaml/keys/goliath-faucet.yaml` file — but remember, you should never commit your secret key in a real-world repository!

Here's how we would format the request _and_ add the signature we need:

```console
pact --unsigned yaml/send/fund-faucet-account.yaml | pact add-sig api/keys/sender00.yaml
```

### 3. Sending Requests

Once we have a suitable JSON payload we can send it to our local Chainweb node.

> If you haven't yet, you should start devnet on your machine (this requires Docker). If you are using the Nix shell you can simply run `devnet-start`. If you aren't, please refer to the `devshell.toml` file for the full command necessary to start your devnet instance.

Chainweb nodes have several endpoints that support Pact, [which you can see in their OpenAPI spec](https://api.chainweb.com/openapi/pact.html). For our purposes, we will only be using these three:

- Use [`/send`](https://api.chainweb.com/openapi/pact.html#tag/endpoint-send/paths/~1send/post) to send a transaction for execution. It returns a request key you can use to look up the transaction later on.
- Use [`/poll`](https://api.chainweb.com/openapi/pact.html#tag/endpoint-poll/paths/~1poll/post) to send a request key for a transaction and retrieve its result, if there is one, or an empty response if not.
- Use [`/listen`](https://api.chainweb.com/openapi/pact.html#tag/endpoint-listen/paths/~1listen/post) to send a request key and block until until there is a result.

We can make a POST request to any of these endpoints at the following path:

```
[HOST]/chainweb/0.0/[NETWORK]/chain/[CHAIN]/pact/api/v1/[ENDPOINT]
```

Let's look at what each of these values can be:

- `HOST`: When you run `devnet-start` it launches the devnet node on `http://localhost:8080`, so that's what we'll use in our tests. When you want to interact with the real Chainweb you can use the public service endpoint (https://api.chainweb.com), though it is recommended that you run your own node.
- `NETWORK`: As we've demonstrated with devnet, there are multiple blockchain networks available for use with Pact. You can distinguish among them using a network identifier. The devnet identifier is `development`. The main Chainweb network is `mainnet01`. There is also a Kadena-run test network, `testnet`.
- `CHAIN`: As discussed in the core concepts, Chainweb uses a braided blockchain structure in which many chains run in parallel. When sending a transaction to a node we must also specify which chain it should be executed on.
- `ENDPOINT`: These are the Pact API endpoints, ie. `/send`, `poll`, and so on.

Let's first try sending a local request, continuing with our `faucet-details` example. We'll format and send the request using `curl`:

```sh
# Format the request. You can inspect the formatted command to verify it is JSON
# as expected (it will be YAML if something went wrong).
payload=$(pact --local --apireq yaml/local/faucet-details.yaml)
echo $payload

# Then, send it to the `local` endpoint:
curl -H 'Content-Type: application/json' -X POST --data "$payload" http://localhost:8080/chainweb/0.0/development/chain/0/pact/api/v1/local
```

If you haven't funded the faucet account yet, you'll see that the request succeeded, but that the goliath-faucet account does not exist:

```jsonc
// This snippet omits fields present in the response to keep this readable.
{
  "status": "failure",
  "error": { "message": "with-read: row not found: goliath-faucet" }
}
```

Let's go ahead and fund the faucet account — if it already exists it will receive more funds, and if it doesn't yet exist then it will be created. We'll use the same `fund-faucet-account` request we formatted before:

```sh
# First, we format the unsigned transaction and then sign it with the sender00
# keys. We can once again print the formatted command to verify it is JSON as
# expected. If you sign with the wrong keys (or the wrong number of keys) you'll
# see an error and a YAML result.
payload=$(pact --unsigned yaml/send/fund-faucet-account.yaml | pact add-sig yaml/keys/sender00.yaml)
echo $payload

# Then, we post the payload to the /send Pact API endpoint on the Chainweb node.
curl -H 'Content-Type: application/json' -X POST --data "$payload" http://localhost:8080/chainweb/0.0/development/chain/0/pact/api/v1/send
```

It can take some time for your transaction to be mined into a block, so the `/send` endpoint returns a request key you can use to query the status of your transaction rather than blocking until there is a result. It looks like this:

```json
{ "requestKeys": ["9L3ePdrgAbQozNg-06FuyWIEuL4VaDHyEthKZZeNlxQ"] }
```

We can now use this request key with one of two endpoints to retrieve the result of our transaction:

- The [`/listen`](https://api.chainweb.com/openapi/pact.html#tag/endpoint-listen/paths/~1listen/post) endpoint blocks until there is a result.
- The [`/poll`](https://api.chainweb.com/openapi/pact.html#tag/endpoint-poll/paths/~1poll/post) endpoint returns an empty object if the transaction is still processing, or the transaction result if it has completed.

I encourage you to try using both endpoints. For this example we'll use the `/listen` endpoint so that we only have to make the request once:

```sh
# This is using the request key returned by the /send endpoint
payload='{ "listen": "9L3ePdrgAbQozNg-06FuyWIEuL4VaDHyEthKZZeNlxQ" }'
curl -H 'Content-Type: application/json' -X POST --data "$payload" http://localhost:8080/chainweb/0.0/development/chain/0/pact/api/v1/listen
```

This request may time out after 60 seconds if your transaction doesn't get mined into a block right away; if so, retry the request. A successful transaction will contain a response with the data "Write succeeded" such as this response:

```jsonc
{
  "gas": 565,
  "result": { "status": "success", "data": "Write succeeded" },
  "reqKey": "FfIkJmWdoeUr3cMr6dXSiCLbwXzSHXND7ZWIZDgL1Mg",
  "logs": "e6ixYW7qPk2oOFdx7GxM0mMSXSnxfF4SXNW1Lg3UMD4",
  "metaData": {
    "blockTime": 1661182348256287,
    "prevBlockHash": "vmS5i1RNRWWeefIC0rIEgIcpOUY--8JNEZaiMrLkku4",
    "blockHash": "oc_MA-u6JSId8sPD8y0HbCy-HKB94fkAyPFX5JYUjE8",
    "blockHeight": 32
  },
  "continuation": null,
  "txId": 43
}
```

Let's verify the transaction behaved the way we would expect by re-running our request to check the faucet account details:

```sh
payload=$(pact --local --apireq yaml/local/faucet-details.yaml)
curl -H 'Content-Type: application/json' -X POST --data "$payload" http://localhost:8080/chainweb/0.0/development/chain/0/pact/api/v1/local
```

This time you should see a response containing "success" data similar to the below response:

```json
{
  "status": "success",
  "data": {
    "guard": {
      "pred": "keys-all",
      "keys": [
        "550fdb22682e109b207a19b6b0ee0d069007d9a3eccedcb2eb7809f4f56b5ecf"
      ]
    },
    "balance": 1000,
    "account": "goliath-faucet"
  }
}
```
